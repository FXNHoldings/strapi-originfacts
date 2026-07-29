/**
 * Airline route-network facts derived from TravelPayouts' free reference data
 * (routes.json / airports.json / planes.json) — no API token, no per-request
 * calls, no AI. Precomputed offline by the enrichment tooling
 * (tp-build-all-facts.mjs) into data/route-facts/all.json, keyed by IATA.
 *
 * ~520 airlines with a meaningful network (>= 3 destinations) are populated;
 * airlines without route data return null, so the Route Network section only
 * renders where we actually have data.
 */
import fs from 'node:fs';
import path from 'node:path';

export type RouteFacts = {
  iata: string;
  name: string;
  isLowcost: boolean | null;
  routeCount: number;
  destinationCount: number;
  countryCount: number;
  keyDestinations: string[];
  topHubs: { city: string; routes: number }[];
  fleet: string[];
  longestRoute: { km: number; from: string; to: string; fromIata: string; toIata: string } | null;
  source: string;
  updated: string;
};

// Load once at module init (cached for the process). Read from disk rather than
// a static import so the ~0.36 MB dataset isn't inlined into every build chunk.
let FACTS: Record<string, RouteFacts> = {};
try {
  const file = path.join(process.cwd(), 'data', 'route-facts', 'all.json');
  FACTS = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, RouteFacts>;
} catch {
  FACTS = {};
}

export function getRouteFacts(iata?: string | null): RouteFacts | null {
  if (!iata) return null;
  return FACTS[iata.toUpperCase()] ?? null;
}
