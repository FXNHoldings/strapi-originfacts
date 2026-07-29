/**
 * Commission Junction (CJ) affiliate links.
 *
 * Env (.env.local, server-only):
 *   CJ_PID  — Website ID (101771882), embedded in every click URL
 *   CJ_CID  — Publisher company ID (5724573), for the CJ REST/GraphQL APIs
 *
 * We link only to advertisers this site is joined with. Each advertiser has a
 * base CJ click URL (with our PID baked in) captured from the Link Search API;
 * Booking.com supports deep-linking, so we can retarget the base link at any
 * booking.com destination via the ?url= param. CheapOair links are used as-is
 * (its affiliate deep-links resolve on cheapoair.com only).
 *
 * All CJ links must render with rel="sponsored noopener" and target="_blank".
 */

const PID = process.env.CJ_PID ?? '101771882';

type Advertiser = {
  id: string;
  name: string;
  /** A joined CJ "Text Link" click URL with our PID; used as the deep-link base. */
  baseClickUrl: string;
  /** Advertiser domain that deep-link ?url= destinations must stay on. */
  deepLinkDomain?: string;
};

export const CJ_ADVERTISERS = {
  bookingAU: {
    id: '7864353',
    name: 'Booking.com Australia',
    baseClickUrl: `https://www.tkqlhce.com/click-${PID}-17289011-1783635015000`,
    deepLinkDomain: 'www.booking.com',
  },
  bookingUK: {
    id: '4297311',
    name: 'Booking.com United Kingdom',
    baseClickUrl: `https://www.kqzyfj.com/click-${PID}-11795693-1779905378000`,
    deepLinkDomain: 'www.booking.com',
  },
  cheapoair: {
    id: '2515404',
    name: 'CheapOair',
    // Flights hub landing; used as-is (no arbitrary deep-linking).
    baseClickUrl: `https://www.kqzyfj.com/click-${PID}-14006804-1783343593000`,
  },
} satisfies Record<string, Advertiser>;

export type CjAdvertiserKey = keyof typeof CJ_ADVERTISERS;

/**
 * A ready-to-use affiliate href for an advertiser. For deep-link-capable
 * advertisers (Booking.com), pass `destination` (must be on the advertiser's
 * domain) to retarget the click at a specific page; otherwise the base link is
 * returned unchanged.
 */
export function cjLink(key: CjAdvertiserKey, destination?: string): string {
  const adv: Advertiser = CJ_ADVERTISERS[key];
  if (destination && adv.deepLinkDomain) {
    try {
      const u = new URL(destination);
      if (u.hostname.endsWith(adv.deepLinkDomain.replace(/^www\./, ''))) {
        return `${adv.baseClickUrl}?url=${encodeURIComponent(destination)}`;
      }
    } catch {
      /* fall through to base link */
    }
  }
  return adv.baseClickUrl;
}

/** Booking.com hotel search deep link for a place name (city, region, landmark). */
export function bookingHotelSearch(
  place: string,
  region: 'AU' | 'UK' = 'AU',
): string {
  const dest = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(place)}`;
  return cjLink(region === 'UK' ? 'bookingUK' : 'bookingAU', dest);
}
