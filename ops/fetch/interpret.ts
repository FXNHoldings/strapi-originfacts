#!/usr/bin/env node
/**
 * Phase 2: conservatively interpret extracted measurements into field-level
 * proposals. Output is review-only and never touches content/airline-facts.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CAPTURES = path.join(ROOT, 'data', 'captures');
type Candidate = { kind: 'dimensions'|'weight'|'count'|'money'|'duration'; raw: string; sentence: string; page_key: string; source_url: string };
type CandidateFile = { carrier_key: string; capture_date: string; extracted_at?: string; candidates: Candidate[] };
type Proposal = {
  module: string; field: string; value: string; source_url: string; evidence: string;
  confidence: number; confidence_band: 'high'|'medium'|'low'; status: 'proposed'|'needs_review';
  rationale: string; flags: string[];
};

function carrierArg(): string | undefined {
  const i = process.argv.indexOf('--carrier');
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function latest(carrier: string): Promise<CandidateFile | null> {
  const sets = (await fs.readdir(CAPTURES).catch(() => [])).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) || x === 'manual');
  const files: CandidateFile[] = [];
  for (const set of sets) {
    const file = path.join(CAPTURES, set, carrier, 'candidates.json');
    try { files.push(JSON.parse(await fs.readFile(file, 'utf8'))); } catch { /* no extraction */ }
  }
  return files.sort((a, b) => (a.extracted_at ?? '').localeCompare(b.extracted_at ?? '')).at(-1) ?? null;
}

function classify(page: string, sentence: string, kind: Candidate['kind']): Omit<Proposal, 'value'|'source_url'|'evidence'|'flags'> | null {
  const s = sentence.toLowerCase();
  if (page === 'baggage_carryon') {
    if (kind === 'dimensions' && /^\s*(?:personal item|small bag)\b/.test(s)) return { module: 'carryon', field: 'personal_item_dimensions', confidence: .94, confidence_band: 'high', status: 'proposed', rationale: 'Sentence explicitly labels the dimensions as a personal item or small bag.' };
    if (kind === 'dimensions' && /carry[ -]?on|cabin bag|overhead|hand baggage/.test(s)) {
      const explicit = /carry[ -]?on (?:bag )?maximum dimensions|maximum dimensions.{0,30}(?:carry[ -]?on|cabin bag|hand baggage)/.test(s);
      return { module: 'carryon', field: 'standard_carryon_dimensions', confidence: explicit ? .9 : .72, confidence_band: explicit ? 'high' : 'medium', status: explicit ? 'proposed' : 'needs_review', rationale: explicit ? 'Sentence explicitly labels maximum carry-on dimensions.' : 'Carry-on context is present, but the bag label may be outside the extracted sentence.' };
    }
    if (kind === 'weight' && /carry[ -]?on|cabin bag|hand baggage/.test(s)) return { module: 'carryon', field: 'carryon_weight_limit', confidence: .82, confidence_band: 'medium', status: 'proposed', rationale: 'Weight appears in explicit carry-on context.' };
  }
  if (['baggage_checked', 'baggage_fees'].includes(page)) {
    if (kind === 'weight' && /checked bag|checked baggage|per (?:bag|piece)|each (?:bag|piece)|weight/.test(s)) return { module: 'baggage', field: 'checked_bag_weight', confidence: .78, confidence_band: 'medium', status: 'proposed', rationale: 'Weight appears in checked-baggage context; fare/route applicability may vary.' };
    if (kind === 'dimensions' && /checked bag|checked baggage|linear|outside dimensions/.test(s)) return { module: 'baggage', field: 'checked_bag_dimensions', confidence: .8, confidence_band: 'medium', status: 'proposed', rationale: 'Dimensions appear in checked-baggage context.' };
    if (kind === 'money' && /(?:bag|baggage).{0,35}(?:fee|cost|price)|(?:fee|cost|price).{0,35}(?:bag|baggage)/.test(s)) return { module: 'baggage', field: 'checked_bag_fee', confidence: .7, confidence_band: 'medium', status: 'needs_review', rationale: 'Explicit baggage fee, but route, timing, currency, and bag-number conditions require review.' };
  }
  if (page === 'checkin' && kind === 'duration') {
    if (/online|app|website|mobile/.test(s) && /check[ -]?in/.test(s)) return { module: 'checkin', field: 'online_checkin_window', confidence: .84, confidence_band: 'medium', status: 'proposed', rationale: 'Duration appears with online/app check-in language.' };
    if (/check[ -]?in|bag (?:drop|acceptance)|boarding pass/.test(s) && /before|prior|closes|cutoff/.test(s)) return { module: 'checkin', field: 'airport_cutoff', confidence: .8, confidence_band: 'medium', status: 'proposed', rationale: 'Duration appears with an airport cutoff or closure statement.' };
  }
  return null;
}

function plausible(rows: Candidate[]): string[] {
  const flags: string[] = [];
  for (const row of rows) {
    const n = Number(row.raw.match(/\d+(?:\.\d+)?/)?.[0]);
    if (!Number.isFinite(n)) continue;
    if (row.kind === 'weight' && (/kg/i.test(row.raw) ? n > 100 : n > 250)) flags.push('implausible_weight');
    if (row.kind === 'dimensions' && n > 300) flags.push('implausible_dimension');
    if (row.kind === 'duration' && (/hour/i.test(row.raw) ? n > 168 : n > 10080)) flags.push('implausible_duration');
  }
  return [...new Set(flags)];
}

const carrier = carrierArg();
if (!carrier) throw new Error('Usage: npm run interpret -- --carrier <carrier_key>');
const input = await latest(carrier);
if (!input) throw new Error(`No candidates for ${carrier}. Run extraction first.`);
const groups = new Map<string, Candidate[]>();
for (const row of input.candidates) {
  const key = `${row.page_key}\u0000${row.source_url}\u0000${row.sentence}\u0000${row.kind}`;
  groups.set(key, [...(groups.get(key) ?? []), row]);
}
const proposals: Proposal[] = [];
for (const rows of groups.values()) {
  const first = rows[0];
  const rule = classify(first.page_key, first.sentence, first.kind);
  if (!rule) continue;
  const values = [...new Set(rows.map((x) => x.raw))];
  const flags = plausible(rows);
  const proposal: Proposal = { ...rule, value: values.join(' / '), source_url: first.source_url, evidence: first.sentence, flags };
  if (first.kind === 'dimensions' && values.length >= 2 && /carry[ -]?on|cabin bag|hand baggage/.test(first.sentence.toLowerCase()) && /personal item|small bag|under (?:the )?seat/.test(first.sentence.toLowerCase())) {
    proposal.flags.push('mixed_bag_types_in_sentence');
    proposal.status = 'needs_review'; proposal.confidence = .45; proposal.confidence_band = 'low';
  }
  proposals.push(proposal);
}

// Identical field labels with different values are not automatically conflicts:
// airlines legitimately vary by route/fare. Flag the ambiguity for a reviewer.
for (const proposal of proposals) {
  const peers = proposals.filter((x) => x.module === proposal.module && x.field === proposal.field);
  if (new Set(peers.map((x) => x.value.toLowerCase())).size > 1) {
    proposal.flags.push('multiple_contextual_values');
    proposal.status = 'needs_review';
    proposal.confidence = Math.min(proposal.confidence, .69);
    proposal.confidence_band = 'low';
  }
  if (proposal.flags.some((x) => x.startsWith('implausible_'))) {
    proposal.status = 'needs_review'; proposal.confidence = .2; proposal.confidence_band = 'low';
  }
}
const deduped = proposals.filter((p, i, all) => all.findIndex((x) => x.module === p.module && x.field === p.field && x.value === p.value && x.source_url === p.source_url && x.evidence === p.evidence) === i);
const unclassified = input.candidates.length - [...groups.values()].filter((rows) => classify(rows[0].page_key, rows[0].sentence, rows[0].kind)).reduce((n, rows) => n + rows.length, 0);
const output = { interpretation_version: 1, generated_at: new Date().toISOString(), carrier_key: carrier, capture_date: input.capture_date, summary: { extracted_candidates: input.candidates.length, field_proposals: deduped.length, high_confidence: deduped.filter((x) => x.confidence_band === 'high').length, needs_review: deduped.filter((x) => x.status === 'needs_review').length, unclassified_candidates: unclassified }, proposals: deduped };
const dest = path.join(ROOT, 'data', 'proposals', 'interpreted', `${carrier}.json`);
await fs.mkdir(path.dirname(dest), { recursive: true });
await fs.writeFile(dest, `${JSON.stringify(output, null, 2)}\n`);
console.log(`${carrier}: ${deduped.length} field proposal(s), ${output.summary.high_confidence} high confidence, ${output.summary.needs_review} need review, ${unclassified} candidates intentionally unclassified.`);
console.log(`Written to ${dest}; fact store unchanged.`);
