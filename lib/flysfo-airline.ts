import type { StrapiAirline } from '@/lib/strapi';

const FLYSFO_BASE = 'https://www.flysfo.com/passengers/flight-info/airlines-sfo';

export type FlySfoAirlineProfile = {
  website?: string;
  generalPhone?: string;
  baggagePhone?: string;
  alliance?: string;
  airportContext?: {
    airportCode: 'SFO';
    terminal?: string;
    level?: string;
    lounge?: string;
    loungeLocation?: string;
    loungeHours?: string;
  };
};

export async function getFlySfoAirlineProfile(airline: Pick<StrapiAirline, 'slug' | 'name'>): Promise<FlySfoAirlineProfile | null> {
  const candidates = airlineSlugCandidates(airline);
  for (const slug of candidates) {
    const profile = await fetchFlySfoProfile(slug);
    if (profile) return profile;
  }
  return null;
}

async function fetchFlySfoProfile(slug: string): Promise<FlySfoAirlineProfile | null> {
  const res = await fetch(`${FLYSFO_BASE}/${slug}`, {
    next: { revalidate: 86400 },
  }).catch(() => null);

  if (!res?.ok) return null;

  const html = await res.text().catch(() => '');
  if (!html) return null;

  const lines = htmlToLines(html);
  if (!lines.length) return null;

  const website = firstMatchingValue(lines, (line) => {
    if (!/^Website\b/i.test(line) || /^View Website\b/i.test(line)) return null;
    return line.replace(/^Website\s*/i, '').trim() || null;
  });
  const generalPhone = valueAfterLabel(lines, 'General Telephone');
  const baggagePhone = valueAfterLabel(lines, 'Baggage Service');
  const alliance = valueAfterLabel(lines, 'Alliance');
  const terminal = valueAfterLabel(lines, 'Terminal');
  const level = valueAfterLabel(lines, 'Level');
  const lounge = valueAfterLabel(lines, 'Lounge');
  const loungeLocation = valueAfterLabel(lines, 'Locations');
  const loungeHours = firstMatchingValue(lines, (line, index) => {
    if (!/^Hours Of Operation$/i.test(line)) return null;
    return nextNonEmptyLine(lines, index + 1);
  });

  const profile: FlySfoAirlineProfile = {
    website: website || undefined,
    generalPhone: generalPhone || undefined,
    baggagePhone: baggagePhone || undefined,
    alliance: alliance || undefined,
  };

  if (terminal || level || lounge || loungeLocation || loungeHours) {
    profile.airportContext = {
      airportCode: 'SFO',
      terminal: terminal || undefined,
      level: level || undefined,
      lounge: lounge || undefined,
      loungeLocation: loungeLocation || undefined,
      loungeHours: loungeHours || undefined,
    };
  }

  return profile.website || profile.generalPhone || profile.baggagePhone || profile.alliance || profile.airportContext
    ? profile
    : null;
}

function airlineSlugCandidates(airline: Pick<StrapiAirline, 'slug' | 'name'>): string[] {
  const candidates = [airline.slug, slugifyAirlineName(airline.name)].filter(Boolean);
  return [...new Set(candidates)];
}

function slugifyAirlineName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’.]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(h\d|p|div|li|section|article|header|footer|main|aside|nav|ul|ol|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&ndash;|&mdash;/gi, '-');

  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function valueAfterLabel(lines: string[], label: string): string | null {
  const labelPattern = new RegExp(`^${escapeRegex(label)}\\s*:\\s*(.*)$`, 'i');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(labelPattern);
    if (!match) continue;
    const inline = match[1]?.trim();
    if (inline) return inline;
    return nextNonEmptyLine(lines, i + 1);
  }
  return null;
}

function nextNonEmptyLine(lines: string[], start: number): string | null {
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (line) return line;
  }
  return null;
}

function firstMatchingValue(
  lines: string[],
  matcher: (line: string, index: number) => string | null,
): string | null {
  for (let i = 0; i < lines.length; i++) {
    const value = matcher(lines[i], i);
    if (value) return value;
  }
  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
