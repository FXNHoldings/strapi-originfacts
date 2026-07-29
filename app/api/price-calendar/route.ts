import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Cheapest fare per departure date for one month on a given route, used to
 * colour-code the flight-search calendar (green/amber/red). Reads live fares
 * from Travelpayouts' Data API (`/v1/prices/calendar`) server-side so the API
 * token never reaches the browser.
 *
 *   GET /api/price-calendar?origin=SIN&destination=LHR&month=2026-08&currency=usd
 *   → { prices: { "2026-08-05": 461, "2026-08-06": 498, ... }, currency: "usd" }
 *
 * Returns an empty map (never an error) when the route/month has no data or the
 * token is missing — the calendar then renders as a plain date picker.
 */
const isMonth = (s: string) => /^\d{4}-\d{2}$/.test(s);
const isIata = (s: string) => /^[A-Za-z]{3}$/.test(s);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = (url.searchParams.get('origin') || '').toUpperCase();
  const destination = (url.searchParams.get('destination') || '').toUpperCase();
  const month = url.searchParams.get('month') || '';
  const currency = (url.searchParams.get('currency') || 'usd').toLowerCase();

  const empty = NextResponse.json({ prices: {}, currency }, { headers: { 'Cache-Control': 'no-store' } });

  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token || !isIata(origin) || !isIata(destination) || !isMonth(month)) return empty;

  try {
    const api = new URL('https://api.travelpayouts.com/v1/prices/calendar');
    api.searchParams.set('depart_date', month);
    api.searchParams.set('calendar_type', 'departure_date');
    api.searchParams.set('origin', origin);
    api.searchParams.set('destination', destination);
    api.searchParams.set('currency', currency);
    api.searchParams.set('token', token);

    const res = await fetch(api.toString(), { cache: 'no-store' });
    const json = (await res.json()) as {
      success?: boolean;
      data?: Record<string, { price?: number }>;
    };

    const prices: Record<string, number> = {};
    if (json?.data) {
      for (const [date, info] of Object.entries(json.data)) {
        if (info && typeof info.price === 'number') prices[date] = Math.round(info.price);
      }
    }
    return NextResponse.json({ prices, currency }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return empty;
  }
}
