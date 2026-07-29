import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Resolves the visitor's nearest city (IATA + name) from their IP, via
 * Travelpayouts' free /whereami endpoint. Called server-side so we can pass the
 * real client IP (Cloudflare / proxy headers) — a browser call would hit the
 * server's own IP and/or CORS. Used to prefill the flight-search "From" field.
 */
export async function GET(request: Request) {
  const h = request.headers;
  const ip =
    h.get('cf-connecting-ip') ||
    (h.get('x-forwarded-for') || '').split(',')[0].trim() ||
    h.get('x-real-ip') ||
    '';

  // Without the visitor's IP the whereami call would resolve the server's
  // location, so bail rather than prefill the wrong city.
  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const res = await fetch(
      `https://www.travelpayouts.com/whereami?locale=en&ip=${encodeURIComponent(ip)}`,
      { cache: 'no-store' },
    );
    const d = (await res.json()) as { iata?: string; name?: string; country_name?: string };
    if (d?.iata && d?.name) {
      return NextResponse.json(
        { code: d.iata, name: d.name, country: d.country_name || '' },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
  } catch {
    /* ignore — no prefill */
  }
  return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
}
