/**
 * Shared SEO/enrichment helpers for the data-driven entity pages
 * (airports, airlines, countries, destinations).
 *
 * Two jobs:
 *  1. Quality gate — `*IsSubstantive()` decides whether a page carries enough
 *     real, page-specific information to deserve indexing. Pages that fail are
 *     served `robots: noindex, follow` and dropped from the sitemap, so Google
 *     only sees pages with genuine content (the fix for the "scaled/low-value
 *     content" AdSense rejection). They stay live for users, and re-enter the
 *     index automatically the moment they gain an `about`, routes, or full geo.
 *  2. Content builders — factual intro prose, FAQ Q&As, and schema.org JSON-LD
 *     derived ONLY from data that exists (no fabrication), to give the pages
 *     that DO pass the gate substantive, unique, structured content.
 *
 * `INDEX_MIN_ABOUT_CHARS` is the single tunable knob for gate strictness.
 */
import type { StrapiAirport, StrapiAirline, StrapiRoute, StrapiCountry } from '@/lib/strapi';
import { getCountryFacts } from '@/lib/country-facts';

export const SITE_URL = 'https://www.originfacts.com';

/**
 * Default social share image (1200×630), used sitewide via app/layout.tsx and
 * as the per-page fallback wherever an entity has no image of its own.
 * Regenerate with: node scripts/generate-og-default.mjs
 */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og/default.png`;

/** An `about` shorter than this is treated as effectively empty for gating. */
export const INDEX_MIN_ABOUT_CHARS = 120;

const hasText = (s?: string | null): s is string =>
  typeof s === 'string' && s.trim().length >= INDEX_MIN_ABOUT_CHARS;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export type Faq = { q: string; a: string };

/** Strips tags + collapses whitespace so schema answers are plain text. */
const plainText = (s: string): string =>
  s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Normalises the free-form `faqs` json field editors fill in Strapi into a
 * clean Faq[]. Accepts `{q, a}` or `{question, answer}` entry shapes, drops
 * anything malformed or empty, and strips HTML. Returns [] unless at least
 * MIN_FAQS real Q&As survive — FAQPage markup with 0-1 entries is worthless
 * and placeholder rows must never reach the schema.
 */
export const MIN_FAQS = 2;

export function normalizeFaqs(raw: unknown): Faq[] {
  if (!Array.isArray(raw)) return [];
  const faqs: Faq[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const q = rec.q ?? rec.question;
    const a = rec.a ?? rec.answer;
    if (typeof q !== 'string' || typeof a !== 'string') continue;
    const cleanQ = plainText(q);
    const cleanA = plainText(a);
    if (!cleanQ || !cleanA) continue;
    faqs.push({ q: cleanQ, a: cleanA });
  }
  return faqs.length >= MIN_FAQS ? faqs : [];
}

/* ------------------------------------------------------------------ *
 * Quality gate
 * ------------------------------------------------------------------ */

/**
 * A page is substantive enough to index when it has REAL content — a written
 * `about` profile OR genuine network data (≥1 tracked route). Identity fields
 * alone (IATA/ICAO/country) are NOT enough: a code-only stub with no routes and
 * no profile is exactly the thin, templated page that triggers the AdSense
 * "scaled content" rejection, so it is noindex+follow until it earns content.
 *
 * `hasRoutes` is supplied by the caller — the page passes `routes.length > 0`;
 * the sitemap passes route-coverage set membership (see fetchRouteCoverage).
 */
export function airportIsSubstantive(a: StrapiAirport, hasRoutes: boolean): boolean {
  return hasText(a.about) || hasRoutes;
}

export function airlineIsSubstantive(a: StrapiAirline, hasRoutes: boolean): boolean {
  return hasText(a.about) || hasRoutes;
}

export function countryHasData(c: Pick<StrapiCountry, 'code' | 'about'>): boolean {
  return hasText(c.about) || Boolean(getCountryFacts(c.code));
}

/** Next.js metadata `robots` block for a gated page. */
export const robotsFor = (indexable: boolean) =>
  indexable
    ? { index: true, follow: true }
    : { index: false, follow: true };

/* ------------------------------------------------------------------ *
 * Derived facts from a route list
 * ------------------------------------------------------------------ */

export type RouteSummary = {
  destinationCount: number;
  countryCount: number;
  carrierCount: number;
  destinationNames: string[];
  countryNames: string[];
  carriers: { name: string; slug: string; iataCode?: string }[];
};

export function summariseRoutes(routes: StrapiRoute[], side: 'origin' | 'destination' = 'destination'): RouteSummary {
  const dests = new Map<string, string>();
  const countries = new Set<string>();
  const carriers = new Map<string, { name: string; slug: string; iataCode?: string }>();
  for (const r of routes) {
    const end = side === 'destination' ? r.destination : r.origin;
    const name = end?.city || end?.name;
    if (end?.iata && name) dests.set(end.iata, name);
    if (end?.country) countries.add(end.country);
    for (const c of r.carriers ?? []) {
      if (c?.slug && c.name) carriers.set(c.slug, { name: c.name, slug: c.slug, iataCode: c.iataCode });
    }
  }
  return {
    destinationCount: dests.size,
    countryCount: countries.size,
    carrierCount: carriers.size,
    destinationNames: [...dests.values()],
    countryNames: [...countries],
    carriers: [...carriers.values()],
  };
}

/* ------------------------------------------------------------------ *
 * Intro prose — factual, built only from present fields
 * ------------------------------------------------------------------ */

const sentence = (parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join('');

export function airportIntro(a: StrapiAirport, s?: RouteSummary): string {
  const code = a.icao ? `${a.iata}/${a.icao}` : a.iata;
  const place = sentence([
    a.city ? ` serving ${a.city}` : '',
    a.country ? `${a.city ? ',' : ' in'} ${a.country}` : '',
    a.region ? ` (${a.region})` : '',
  ]);
  const lead = `${a.name} (${code}) is an airport${place}.`;
  const geo =
    num(a.latitude) && num(a.longitude)
      ? ` It sits at ${a.latitude!.toFixed(3)}°, ${a.longitude!.toFixed(3)}°${a.timezone ? ` and keeps ${a.timezone} local time` : ''}.`
      : a.timezone
        ? ` It observes ${a.timezone} local time.`
        : '';
  const net =
    s && s.destinationCount > 0
      ? ` Originfacts tracks ${pluralise(s.destinationCount, 'destination')} reachable from ${a.iata}${s.countryCount > 1 ? ` across ${pluralise(s.countryCount, 'country', 'countries')}` : ''}${s.carrierCount > 0 ? `, served by ${pluralise(s.carrierCount, 'airline')}` : ''}.`
      : '';
  return lead + geo + net;
}

export function airlineIntro(a: StrapiAirline, s?: RouteSummary): string {
  const code = a.iataCode ? (a.icaoCode ? `${a.iataCode}/${a.icaoCode}` : a.iataCode) : a.icaoCode;
  const kind = a.type ? `${a.type.toLowerCase()} airline` : 'airline';
  const based = sentence([
    a.city ? ` based in ${a.city}` : '',
    a.country ? `${a.city ? ', ' : ' based in '}${a.country}` : '',
  ]);
  const founded = num(a.founded) ? ` and founded in ${a.founded}` : '';
  const lead = `${a.name}${code ? ` (${code})` : ''} is a ${kind}${based}${founded}.`;
  const hub = a.airport ? ` Its operations are centred on ${a.airport}.` : '';
  const net =
    s && s.destinationCount > 0
      ? ` Originfacts tracks ${pluralise(s.destinationCount, 'destination')} on its network${s.countryCount > 1 ? ` across ${pluralise(s.countryCount, 'country', 'countries')}` : ''}.`
      : '';
  return lead + hub + net;
}

/* ------------------------------------------------------------------ *
 * FAQs — every answer is grounded in a present field
 * ------------------------------------------------------------------ */

export function airportFaqs(a: StrapiAirport, s?: RouteSummary): Faq[] {
  const faqs: Faq[] = [];
  if (a.city || a.country) {
    faqs.push({
      q: `Where is ${a.name}?`,
      a: `${a.name} is located in ${[a.city, a.country].filter(Boolean).join(', ')}${a.region ? ` (${a.region})` : ''}${num(a.latitude) && num(a.longitude) ? `, at coordinates ${a.latitude!.toFixed(3)}°, ${a.longitude!.toFixed(3)}°` : ''}.`,
    });
  }
  faqs.push({
    q: `What is the airport code for ${a.name}?`,
    a: `Its IATA code is ${a.iata}${a.icao ? ` and its ICAO code is ${a.icao}` : ''}.`,
  });
  if (a.timezone) {
    faqs.push({ q: `What time zone is ${a.iata} in?`, a: `${a.name} operates on ${a.timezone} local time.` });
  }
  if (s && s.carriers.length) {
    faqs.push({
      q: `Which airlines fly from ${a.iata}?`,
      a: `Carriers tracked on routes from ${a.iata} include ${listProse(s.carriers.map((c) => c.name), 6)}.`,
    });
  }
  if (s && s.destinationNames.length) {
    faqs.push({
      q: `Where can you fly from ${a.iata}?`,
      a: `Tracked destinations from ${a.iata} include ${listProse(s.destinationNames, 8)}.`,
    });
  }
  return faqs;
}

export function airlineFaqs(a: StrapiAirline, s?: RouteSummary): Faq[] {
  const faqs: Faq[] = [];
  if (a.iataCode || a.icaoCode) {
    faqs.push({
      q: `What is ${a.name}'s airline code?`,
      a: `${a.name}'s IATA code is ${a.iataCode ?? 'not assigned'}${a.icaoCode ? ` and its ICAO code is ${a.icaoCode}` : ''}.`,
    });
  }
  if (a.country || a.city) {
    faqs.push({
      q: `Where is ${a.name} based?`,
      a: `${a.name} is based in ${[a.city, a.country].filter(Boolean).join(', ')}${a.airport ? `, operating mainly from ${a.airport}` : ''}.`,
    });
  }
  if (num(a.founded)) {
    faqs.push({ q: `When was ${a.name} founded?`, a: `${a.name} was founded in ${a.founded}.` });
  }
  if (a.type) {
    faqs.push({ q: `What type of airline is ${a.name}?`, a: `${a.name} is classified as a ${a.type.toLowerCase()} airline.` });
  }
  if (s && s.destinationNames.length) {
    faqs.push({
      q: `Where does ${a.name} fly?`,
      a: `Tracked destinations on ${a.name}'s network include ${listProse(s.destinationNames, 8)}.`,
    });
  }
  return faqs;
}

/* ------------------------------------------------------------------ *
 * schema.org JSON-LD
 * ------------------------------------------------------------------ */

export function airportJsonLd(a: StrapiAirport, url: string): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Airport',
    name: a.name,
    iataCode: a.iata,
    url,
  };
  if (a.icao) ld.icaoCode = a.icao;
  if (a.city || a.country) {
    ld.address = {
      '@type': 'PostalAddress',
      ...(a.city ? { addressLocality: a.city } : {}),
      ...(a.country ? { addressCountry: a.country } : {}),
    };
  }
  if (num(a.latitude) && num(a.longitude)) {
    ld.geo = { '@type': 'GeoCoordinates', latitude: a.latitude, longitude: a.longitude };
  }
  return ld;
}

export function airlineJsonLd(a: StrapiAirline, url: string): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Airline',
    name: a.name,
    url,
  };
  if (a.iataCode) ld.iataCode = a.iataCode;
  if (a.legalName) ld.legalName = a.legalName;
  if (a.country) ld.areaServed = a.country;
  if (a.website) ld.sameAs = a.website.startsWith('http') ? a.website : `https://${a.website}`;
  return ld;
}

export type CountryLike = { code: string; name: string; region?: string; currency?: string };

export function countryFaqs(c: CountryLike, counts: { airports: number; airlines: number }): Faq[] {
  const facts = getCountryFacts(c.code);
  const faqs: Faq[] = [];
  if (counts.airports > 0) {
    faqs.push({
      q: `How many airports does ${c.name} have?`,
      a: `Originfacts lists ${counts.airports.toLocaleString()} commercial airport${counts.airports === 1 ? '' : 's'} in ${c.name}.`,
    });
  }
  if (counts.airlines > 0) {
    faqs.push({
      q: `Which airlines are based in ${c.name}?`,
      a: `Originfacts tracks ${counts.airlines.toLocaleString()} airline${counts.airlines === 1 ? '' : 's'} based in ${c.name}. See the list above for each carrier's profile.`,
    });
  }
  const currencyText = facts?.currencyName
    ? `${facts.currencyName}${facts.currencyCode ? ` (${facts.currencyCode})` : ''}`
    : c.currency || facts?.currencyCode;
  if (currencyText) {
    faqs.push({ q: `What currency is used in ${c.name}?`, a: `${c.name} uses the ${currencyText}.` });
  }
  if (facts?.capital) {
    faqs.push({ q: `What is the capital of ${c.name}?`, a: `The capital of ${c.name} is ${facts.capital}.` });
  }
  if (facts?.languages?.length) {
    faqs.push({
      q: `What languages are spoken in ${c.name}?`,
      a: `The main languages of ${c.name} are ${facts.languages.join(', ')}.`,
    });
  }
  return faqs;
}

export function countryJsonLd(c: CountryLike, url: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Country',
    name: c.name,
    identifier: c.code,
    url,
  };
}

export function faqJsonLd(faqs: Faq[]): Record<string, unknown> | null {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Small text utilities
 * ------------------------------------------------------------------ */

function pluralise(n: number, singular: string, plural = `${singular}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? singular : plural}`;
}

/** "A, B, C and 4 more" — for inline prose lists. */
function listProse(items: string[], max = 6): string {
  const seen = [...new Set(items.filter(Boolean))];
  if (seen.length === 0) return '';
  const shown = seen.slice(0, max);
  const rest = seen.length - shown.length;
  const joined =
    shown.length === 1
      ? shown[0]
      : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : joined;
}
