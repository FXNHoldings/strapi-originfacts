/**
 * Provenance-backed fact store for Tier 1 airline pages.
 *
 * One file per airline at content/airline-facts/<slug>.json.
 *
 * Provenance is per FIELD, not per module. A module-level source list lets a
 * table publish a cell nobody sourced as long as the module cites something —
 * which is rule 3 of the fact-store contract violated by construction. Every
 * published value carries its own `source_url` and `verified_at`, and a module
 * publishes only when every field it declares required is `official`.
 *
 * Statuses are deliberately five, not two:
 *   official     the carrier's own page or a named regulator          → renders
 *   third_party  aggregator, encyclopedia, blog — plausible, unconfirmed
 *   disputed     credible sources disagree                            → conflict shown
 *   pending      not researched, or the lookup failed
 *   n/a          does not apply to this carrier
 *
 * Only `official` renders. Everything else leaves the module in its unpublished
 * state, which is a visible gap rather than a plausible-looking paragraph with
 * nothing behind it.
 *
 * Field names and dates are snake_case here and in the files, matching the
 * fact-store contract rather than the surrounding TypeScript. The files are the
 * artefact a person edits and a validator checks; consistency with the contract
 * matters more than consistency with the codebase's casing.
 */
import fs from 'node:fs';
import path from 'node:path';

export type FieldStatus = 'official' | 'third_party' | 'disputed' | 'pending' | 'n/a';

export type FactField = {
  /** Null whenever the status is not `official` — nothing to show. */
  value: string | null;
  status: FieldStatus;
  /** Required for `official`. The page the value was read from. */
  source_url?: string;
  /**
   * Required for `official`. Never widened: if the source gives a year, this
   * holds a year. Padding 1985 to 1985-01-01 invents precision.
   */
  verified_at?: string;
  notes?: string;
  /** Required for `disputed` — both readings, so neither is silently chosen. */
  conflicting_values?: string[];
};

/** Cells name field keys, so no cell can reach the page without provenance. */
export type FactTable = {
  caption: string;
  columns: string[];
  rows: { label: string; cells: string[] }[];
};

export type FactRule = { key: string; text: string };

/**
 * An optional diagram belonging to a module. A small tagged union rather than
 * free-form markup, so a fact file can never inject arbitrary HTML and every
 * figure stays something the renderer can caption and label.
 */
export type FactFigure = {
  kind: 'longest-sector';
  fromCity: string;
  fromIata: string;
  toCity: string;
  toIata: string;
  km: number;
};

export type SourcedModule = {
  id: string;
  title: string;
  lede?: string;
  body?: string[];
  fields?: Record<string, FactField>;
  /** Field keys that must all be `official` before the module publishes. */
  required?: string[];
  table?: FactTable;
  rule?: FactRule;
};

export type AirlineFactsFile = {
  slug: string;
  /**
   * The carrier's own site. Top-level so validation is self-contained — the
   * rule that a contact phone or address must be sourced from the carrier's own
   * domain cannot depend on Strapi being reachable at build time.
   */
  official_website: string;
  modules: SourcedModule[];
};

/* ------------------------------------------------------------------ *
 * Resolving a module for render
 * ------------------------------------------------------------------ */

export type ResolvedField = { key: string; label: string; field: FactField };

export type ResolvedModule = {
  id: string;
  title: string;
  /** False when any required field is not `official`. */
  published: boolean;
  /** Field keys that blocked publication, with the status that blocked them. */
  blockers: { key: string; status: FieldStatus }[];
  /** Oldest `verified_at` among the official fields. */
  verified_at: string | null;
  lede?: string;
  body?: string[];
  table?: { caption: string; columns: string[]; rows: { label: string; cells: (FactField | null)[] }[] };
  rule?: FactRule;
  /** Disputed fields, rendered as stated conflicts rather than resolved. */
  disputes: ResolvedField[];
};

const isOfficial = (f: FactField | undefined): f is FactField => f?.status === 'official';

export function resolveModule(m: SourcedModule): ResolvedModule {
  const fields = m.fields ?? {};
  const required = m.required ?? Object.keys(fields);

  const blockers = required
    .map((key) => ({ key, status: fields[key]?.status ?? ('pending' as FieldStatus) }))
    .filter((b) => b.status !== 'official');

  const officialDates = Object.values(fields)
    .filter(isOfficial)
    .map((f) => f.verified_at)
    .filter((d): d is string => Boolean(d))
    .sort();

  const disputes = Object.entries(fields)
    .filter(([, f]) => f.status === 'disputed')
    .map(([key, field]) => ({ key, label: key.replace(/_/g, ' '), field }));

  return {
    id: m.id,
    title: m.title,
    published: blockers.length === 0,
    blockers,
    verified_at: officialDates[0] ?? null,
    lede: m.lede,
    body: m.body,
    rule: m.rule,
    disputes,
    table: m.table
      ? {
          caption: m.table.caption,
          columns: m.table.columns,
          rows: m.table.rows.map((row) => ({
            label: row.label,
            // An unresolvable or non-official cell renders as absent. It cannot
            // reach the page as text, and a required field would already have
            // blocked the whole module.
            cells: row.cells.map((key) => (isOfficial(fields[key]) ? fields[key] : null)),
          })),
        }
      : undefined,
  };
}

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

const DIR = path.join(process.cwd(), 'content', 'airline-facts');

/**
 * Files whose name begins with an underscore are fixtures and samples. They are
 * never loadable by slug, and the validator fails the build on them — mock data
 * has reached production once already, stamped "Verified", and the fix for that
 * is structural rather than procedural.
 */
export function getAirlineFacts(slug: string): AirlineFactsFile | null {
  if (slug.startsWith('_')) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(DIR, `${slug}.json`), 'utf8')) as AirlineFactsFile & {
      _warning?: unknown;
    };
    // Belt to the validator's braces: a file still carrying a mock warning does
    // not render, whatever else is true of it.
    if (parsed._warning !== undefined) return null;
    if (!parsed.official_website || !Array.isArray(parsed.modules)) return null;
    return { slug: parsed.slug || slug, official_website: parsed.official_website, modules: parsed.modules };
  } catch {
    return null;
  }
}

/** Oldest verification date across modules that actually published. */
export function oldestVerifiedAt(modules: ResolvedModule[]): string | null {
  const dates = modules
    .filter((m) => m.published)
    .map((m) => m.verified_at)
    .filter((d): d is string => Boolean(d))
    .sort();
  return dates[0] ?? null;
}
