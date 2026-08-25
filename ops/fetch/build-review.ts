#!/usr/bin/env node
/**
 * Phase 3: turn interpreted proposals into a compact review report and
 * preview-only fact files. Never writes content/airline-facts or deploys.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pageEntry, type Carrier } from './types.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PROPOSALS = path.join(ROOT, 'data', 'proposals');
const INPUT = path.join(PROPOSALS, 'interpreted');
const PREVIEWS = path.join(PROPOSALS, 'preview-facts');
type Proposal = { module: string; field: string; value: string; source_url: string; evidence: string; confidence: number; confidence_band: string; status: string; rationale: string; flags: string[] };
type Interpretation = { carrier_key: string; capture_date: string; summary: Record<string, number>; proposals: Proposal[] };
type Field = { value: string|null; status: string; source_url?: string; notes?: string };
type Module = { id: string; title: string; required?: string[]; fields: Record<string, Field> };
type FactDoc = { slug: string; official_website: string; modules: Module[] };

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const title = (id: string) => ({ carryon: 'Carry-on', baggage: 'Checked baggage', checkin: 'Check-in and airport cutoffs', fares: 'Fares', rights: 'Passenger rights' } as Record<string,string>)[id] ?? id;
const slugKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const files = (await fs.readdir(INPUT).catch(() => [])).filter((x) => x.endsWith('.json')).sort();
if (!files.length) throw new Error('No interpreted proposals. Run interpret:batch first.');
const docs: Interpretation[] = [];
for (const file of files) docs.push(JSON.parse(await fs.readFile(path.join(INPUT, file), 'utf8')));
const carriers = JSON.parse(await fs.readFile(path.join(import.meta.dirname, 'carriers.json'), 'utf8')) as Carrier[];
await fs.mkdir(PREVIEWS, { recursive: true });

const manifest: { generated_at: string; approval_state: string; carriers: unknown[] } = { generated_at: new Date().toISOString(), approval_state: 'unreviewed', carriers: [] };
for (const interpreted of docs) {
  const carrier = carriers.find((x) => x.carrier_key === interpreted.carrier_key);
  const firstPage = carrier && Object.values(carrier.pages).map(pageEntry).find(Boolean);
  const existingPath = path.join(ROOT, 'content', 'airline-facts', `${interpreted.carrier_key}.json`);
  const existing = await fs.readFile(existingPath, 'utf8').then((x) => JSON.parse(x) as FactDoc).catch(() => null);
  const preview: FactDoc = existing ? structuredClone(existing) : { slug: interpreted.carrier_key, official_website: firstPage ? new URL(firstPage.url).origin : '', modules: [] };
  const operations: unknown[] = [];
  const counters = new Map<string, number>();
  for (const proposal of interpreted.proposals) {
    let mod = preview.modules.find((x) => x.id === proposal.module);
    if (!mod) { mod = { id: proposal.module, title: title(proposal.module), fields: {} }; preview.modules.push(mod); }
    const base = `proposal_${slugKey(proposal.field)}`;
    let n = (counters.get(`${proposal.module}.${base}`) ?? 0) + 1;
    counters.set(`${proposal.module}.${base}`, n);
    let key = `${base}_${n}`;
    while (mod.fields[key]) key = `${base}_${++n}`;
    mod.fields[key] = {
      value: proposal.value,
      status: 'pending',
      source_url: proposal.source_url,
      notes: `[PREVIEW PROPOSAL — NOT APPROVED] Confidence ${proposal.confidence}. ${proposal.rationale} Evidence: ${proposal.evidence}${proposal.flags.length ? ` Flags: ${proposal.flags.join(', ')}.` : ''}`,
    };
    operations.push({ ...proposal, operation: 'review_field', proposed_key: key, approval: 'unreviewed' });
  }
  await fs.writeFile(path.join(PREVIEWS, `${interpreted.carrier_key}.json`), `${JSON.stringify(preview, null, 2)}\n`);
  manifest.carriers.push({ carrier_key: interpreted.carrier_key, capture_date: interpreted.capture_date, existing_fact_file: Boolean(existing), preview_file: `preview-facts/${interpreted.carrier_key}.json`, summary: interpreted.summary, operations });
}
await fs.writeFile(path.join(PROPOSALS, 'review-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const cards = docs.map((doc) => {
  const modules = [...new Set(doc.proposals.map((p) => p.module))];
  const groups = modules.map((module) => {
    const proposals = doc.proposals.filter((p) => p.module === module);
    const rows = proposals.map((p) => `<tr class="${esc(p.status)}"><td>${esc(p.field)}</td><td>${esc(p.value)}</td><td>${esc(p.confidence)} (${esc(p.confidence_band)})</td><td>${esc(p.status)}</td><td>${esc(p.flags.join(', ') || '—')}</td><td>${esc(p.evidence)}</td><td><a href="${esc(p.source_url)}" rel="noreferrer">source</a></td></tr>`).join('');
    return `<details class="module"><summary><span>${esc(title(module))}</span><small>${proposals.length} proposal${proposals.length === 1 ? '' : 's'}</small></summary><div class="table"><table><thead><tr><th>Field</th><th>Value</th><th>Confidence</th><th>Status</th><th>Flags</th><th>Evidence</th><th>Official page</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  }).join('');
  const stats = `${doc.summary.field_proposals ?? 0} proposals · ${doc.summary.high_confidence ?? 0} high confidence · ${doc.summary.needs_review ?? 0} need review · ${doc.summary.unclassified_candidates ?? 0} unclassified`;
  return `<details class="airline"><summary><span>${esc(doc.carrier_key)}</span><small>${esc(stats)}</small></summary><div class="airline-body">${groups || '<p>No field proposals from the available evidence.</p>'}</div></details>`;
}).join('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Airline fact review</title><style>body{font:15px/1.45 system-ui;margin:0;background:#f6f8fb;color:#172033}main{max-width:1500px;margin:auto;padding:32px}h1{margin:0 0 8px}details{background:white;border:1px solid #dce3ec;border-radius:8px;margin:14px 0;overflow:hidden}summary{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:17px 20px;cursor:pointer;list-style:none}summary::-webkit-details-marker{display:none}summary:after{content:'+';font-size:24px;line-height:1;color:#53647a}details[open]>summary:after{content:'−'}summary span{font-size:20px;font-weight:700;text-transform:capitalize}summary small{margin-left:auto;color:#64748b}.airline-body{padding:0 18px 12px;border-top:1px solid #e7ecf2}.module{margin:12px 0;background:#fbfcfe}.module summary{padding:12px 15px}.module summary span{font-size:16px}.table{overflow:auto;border-top:1px solid #e7ecf2}table{border-collapse:collapse;width:100%;min-width:1000px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #e7ecf2;padding:9px}th{background:#f5f7fa;position:sticky;top:0}.needs_review td{background:#fffaf0}a{color:#0759b8}@media(max-width:700px){main{padding:18px}summary{align-items:flex-start;flex-wrap:wrap}summary small{width:100%;margin:0}}</style></head><body><main><h1>Airline fact proposal review</h1><p>Generated ${esc(manifest.generated_at)}. Everything is <strong>unreviewed</strong>; this report cannot publish facts. Open an airline, then a content section, to inspect its evidence.</p>${cards}</main></body></html>`;
await fs.writeFile(path.join(PROPOSALS, 'review.html'), html);
console.log(`Review built for ${docs.length} airline(s), ${docs.reduce((n, x) => n + x.proposals.length, 0)} proposal(s).`);
console.log(`Open ${path.join(PROPOSALS, 'review.html')}`);
console.log('Preview fact files are pending-only; content/airline-facts was not changed.');
