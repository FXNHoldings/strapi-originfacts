const RAPIDAPI_KEY = process.env.RAPIDAPI_AIRPORT_INFO_KEY;
const RAPIDAPI_HOST = 'airport-info.p.rapidapi.com';

export type AirportInfoRecord = {
  id?: number;
  iata?: string;
  icao?: string;
  name?: string;
  location?: string;
  street_number?: string;
  street?: string;
  city?: string;
  county?: string;
  state?: string;
  country_iso?: string;
  country?: string;
  postal_code?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  uct?: number;
  website?: string;
};

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normaliseAirportInfo(raw: unknown): AirportInfoRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.error) return null;
  return {
    id: toNumber(record.id),
    iata: typeof record.iata === 'string' ? record.iata : undefined,
    icao: typeof record.icao === 'string' ? record.icao : undefined,
    name: typeof record.name === 'string' ? record.name : undefined,
    location: typeof record.location === 'string' ? record.location : undefined,
    street_number: typeof record.street_number === 'string' ? record.street_number : undefined,
    street: typeof record.street === 'string' ? record.street : undefined,
    city: typeof record.city === 'string' ? record.city : undefined,
    county: typeof record.county === 'string' ? record.county : undefined,
    state: typeof record.state === 'string' ? record.state : undefined,
    country_iso: typeof record.country_iso === 'string' ? record.country_iso : undefined,
    country: typeof record.country === 'string' ? record.country : undefined,
    postal_code: typeof record.postal_code === 'string' ? record.postal_code : undefined,
    phone: typeof record.phone === 'string' ? record.phone : undefined,
    latitude: toNumber(record.latitude),
    longitude: toNumber(record.longitude),
    uct: toNumber(record.uct),
    website: typeof record.website === 'string' ? record.website : undefined,
  };
}

export async function getAirportInfoByCode(args: { iata?: string; icao?: string }) {
  if (!RAPIDAPI_KEY) return null;

  const codeParam = args.iata
    ? ['iata', args.iata]
    : args.icao
      ? ['icao', args.icao]
      : null;

  if (!codeParam) return null;

  const [key, value] = codeParam;
  const url = new URL(`https://${RAPIDAPI_HOST}/airport`);
  url.searchParams.set(key, value);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return null;
    return normaliseAirportInfo(await res.json());
  } catch {
    return null;
  }
}

export function airportInfoAddress(info: AirportInfoRecord | null): string | null {
  if (!info) return null;
  const line1 = [info.street_number, info.street].filter(Boolean).join(' ').trim();
  const line2 = [info.city, info.state, info.postal_code].filter(Boolean).join(', ').trim();
  const parts = [line1, line2, info.country].filter(Boolean);
  return parts.length ? parts.join(', ') : info.location ?? null;
}
