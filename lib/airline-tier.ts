/**
 * How much page an airline earns, and whether it is indexed at all.
 *
 * This replaces `airlineIsSubstantive()`, which gated on the presence of the
 * CMS `about` field. That test stopped discriminating the moment the enrichment
 * pass wrote an `about` onto 1,019 of the 1,096 airlines: every page satisfied
 * the gate at once and the directory began admitting itself to the sitemap —
 * GDS vendors and carriers that have not flown in years included. A gate that
 * generated text can open is not a gate.
 *
 * Tiering keys off data the page can point at instead:
 *   - route-network facts derived from TravelPayouts (data/route-facts/all.json)
 *   - the ingested review store (content/airline-reviews/)
 *   - routes tracked in Strapi, which the page renders as real route cards
 *
 * None of those can be satisfied by writing prose, which is the property the
 * old gate lost.
 *
 * Tier 3 pages stay live and stay linked — /airlines lists every carrier — they
 * just carry `noindex, follow` and stay out of the sitemap.
 */
import type { StrapiAirline } from '@/lib/strapi';
import { getRouteFacts } from '@/lib/route-facts';
import { hasAirlineReviews } from '@/lib/airline-reviews';

/** 1 = full treatment, 2 = data modules only, 3 = directory row only. */
export type AirlineTier = 1 | 2 | 3;

/** Destinations a carrier must serve to earn the full Tier 1 treatment. */
export const TIER1_MIN_DESTINATIONS = 80;

/**
 * A smaller network still earns Tier 1 when the carrier also has ingested
 * reviews — that pairing gives the page first-party material no template can
 * produce.
 */
export const TIER1_REVIEWED_MIN_DESTINATIONS = 40;

/** Below this a carrier has too little network to describe. Tunable knob. */
export const TIER2_MIN_DESTINATIONS = 5;

export type AirlineTierInput = Pick<StrapiAirline, 'slug' | 'iataCode'>;

/**
 * `hasTrackedRoutes` is supplied by the caller, matching the old gate: the page
 * passes `routes.length > 0`, the sitemap passes route-coverage set membership
 * (see fetchRouteCoverage).
 */
export function airlineTier(a: AirlineTierInput, hasTrackedRoutes: boolean): AirlineTier {
  const destinations = getRouteFacts(a.iataCode)?.destinationCount ?? 0;

  if (destinations >= TIER1_MIN_DESTINATIONS) return 1;
  if (destinations >= TIER1_REVIEWED_MIN_DESTINATIONS && hasAirlineReviews(a.slug)) return 1;
  if (destinations >= TIER2_MIN_DESTINATIONS || hasTrackedRoutes) return 2;
  return 3;
}

/**
 * Indexable, and eligible for the sitemap.
 *
 * Reviews alone deliberately do NOT lift a carrier out of Tier 3. 75 carriers
 * have ingested reviews but no route data at all, and reviews outlive
 * operations — several of those look like airlines that stopped flying after
 * the reviews were written. They stay out of the index until an operating
 * status is recorded against them rather than inferred here.
 */
export function airlineIsIndexable(a: AirlineTierInput, hasTrackedRoutes: boolean): boolean {
  return airlineTier(a, hasTrackedRoutes) < 3;
}
