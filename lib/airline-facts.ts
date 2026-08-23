/**
 * Provenance-backed fact store for Tier 1 airline pages.
 *
 * One file per airline at content/airline-facts/<slug>.json. Every module in a
 * file carries its own sources and its own verification date, because a module
 * is only as fresh as its stalest field — a page-level "last updated" stamp
 * printed by the template is decoration, not evidence.
 *
 * The rule the renderer enforces: a module with no file, or no sources, does
 * not render its content. It renders as unpublished instead. There is no
 * fallback prose, because a plausible-looking paragraph with nothing behind it
 * is exactly what this store exists to keep off the page.
 *
 * Shapes here mirror the module anatomy of the Tier 1 design — lede, body,
 * table, hard rule, conflicts, sources — so an ingest script (the airline
 * spreadsheet) has a single obvious target to write into.
 */
import fs from 'node:fs';
import path from 'node:path';

/** A module is verified, or it is flagged, or it does not publish. */
export type FactStatus = 'verified' | 'disputed';

export type FactSource = {
  /** Publisher plus document, e.g. "Qantas, Checked baggage allowances". */
  label: string;
  url?: string;
  /** "primary", "fee change dates" — why this source is cited. */
  note?: string;
};

/**
 * A table cell. Plain text in the common case; `{ text, href }` where the value
 * IS its own source — a link the reader can click to check the claim, such as a
 * carrier's conditions of carriage or a fee schedule.
 */
export type FactCell = string | { text: string; href: string };

export type FactTable = {
  caption: string;
  columns: string[];
  /** First cell is the row header; the rest line up with `columns`. */
  rows: FactCell[][];
};

/**
 * A single figure that overrides everything around it — the design's rule box.
 * Used where one limit cuts across every row of a table.
 */
export type FactRule = { key: string; text: string };

/**
 * Where sources disagree. Rendering the disagreement is the point: a module
 * that prints one of two conflicting numbers has guessed, and a reader has no
 * way to know it happened.
 */
export type FactConflict = { title: string; text: string };

/**
 * What a module's date actually means.
 *
 * `verified` — someone checked this against a source on that date. Only these
 * feed the page's "last reviewed" line, because only these describe an act of
 * verification.
 *
 * `data` — the vintage of an underlying dataset, not a review of it. A route
 * dump built in July or a review corpus whose newest entry is from 2023 is
 * exactly that old, and saying so is the point — but rolling it into a
 * page-level "last reviewed" would misreport an editorial claim the site has
 * not made. Modules like these stamp "Data as of" instead.
 */
export type FactDateKind = 'verified' | 'data';

/**
 * An optional diagram belonging to a module.
 *
 * Kept as a small tagged union rather than free-form markup so a fact file can
 * never inject arbitrary HTML, and so every figure stays something the
 * renderer knows how to caption and label for screen readers.
 */
export type FactFigure = {
  kind: 'longest-sector';
  fromCity: string;
  fromIata: string;
  toCity: string;
  toIata: string;
  km: number;
};

export type FactModule = {
  /** Matches the module ids the page lays out; unknown ids are ignored. */
  id: string;
  title: string;
  status: FactStatus;
  /** YYYY-MM-DD. Drives the module stamp, and the ledger when kind is 'verified'. */
  verifiedAt: string;
  /** Defaults to 'verified' — fact-store modules are checked by a person. */
  dateKind?: FactDateKind;
  /** Short label shown instead of the date when status is 'disputed'. */
  statusNote?: string;
  lede?: string;
  body?: string[];
  table?: FactTable;
  rule?: FactRule;
  conflicts?: FactConflict[];
  figure?: FactFigure;
  sources: FactSource[];
  /** Free-text footer under the sources, e.g. "next review Nov 2026". */
  reviewNote?: string;
};

export type AirlineFactsFile = {
  slug: string;
  modules: FactModule[];
};

const DIR = path.join(process.cwd(), 'content', 'airline-facts');

/**
 * A module without at least one source is dropped rather than rendered, so a
 * half-filled spreadsheet row cannot reach the page by accident.
 */
function usable(m: FactModule): boolean {
  return Boolean(m && m.id && m.title && m.verifiedAt && Array.isArray(m.sources) && m.sources.length > 0);
}

export function getAirlineFacts(slug: string): AirlineFactsFile | null {
  try {
    const raw = fs.readFileSync(path.join(DIR, `${slug}.json`), 'utf8');
    const parsed = JSON.parse(raw) as AirlineFactsFile;
    const modules = Array.isArray(parsed.modules) ? parsed.modules.filter(usable) : [];
    return { slug: parsed.slug || slug, modules };
  } catch {
    return null;
  }
}

/**
 * The design's sample content, kept under a leading underscore so it can never
 * collide with a real slug. Loaded only behind the preview's ?sample=1 flag —
 * these figures came from the design mock and are NOT verified.
 */
export function getSampleFacts(slug: string): AirlineFactsFile | null {
  try {
    const raw = fs.readFileSync(path.join(DIR, `_sample.${slug}.json`), 'utf8');
    const parsed = JSON.parse(raw) as AirlineFactsFile;
    const modules = Array.isArray(parsed.modules) ? parsed.modules.filter(usable) : [];
    return { slug: parsed.slug || slug, modules };
  } catch {
    return null;
  }
}

/**
 * Oldest date across modules that were actually verified by a person.
 *
 * Dataset-vintage modules are excluded deliberately. Letting them in produced
 * a page-wide "Last full review 6 Dec 2023" on the Qantas pilot — the newest
 * TripAdvisor review date presented as the date the page was last checked,
 * which reads as an abandoned page rather than an honest one.
 *
 * Returns null when nothing has been verified yet, and the caller renders no
 * date at all rather than inventing one.
 */
export function oldestVerifiedAt(modules: FactModule[]): string | null {
  const dates = modules
    .filter((m) => (m.dateKind ?? 'verified') === 'verified')
    .map((m) => m.verifiedAt)
    .filter(Boolean)
    .sort();
  return dates[0] ?? null;
}
