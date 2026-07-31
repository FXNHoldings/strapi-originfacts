import fs from 'node:fs';
import path from 'node:path';

/**
 * Loader for the unified airline-review store (content/airline-reviews/*.json).
 * Files are produced by ingestion adapters — currently the Kaggle Skytrax
 * archive (scripts/ingest-skytrax-kaggle.py) and TripAdvisor bulk exports
 * (scripts/ingest-tripadvisor-xml.py); later adapters (live Skytrax scrape,
 * Google, Trustpilot…) merge into the same files under their own `source` tag.
 *
 * Ratings are normalised to a 0–10 scale on the way in, so sources published on
 * different scales stay comparable. TripAdvisor's 1–5 stars are doubled.
 */

export type AirlineReview = {
  source: string;
  id: string;
  date: string;                     // YYYY-MM-DD
  rating10: number | null;          // normalised to 0–10 by the adapter
  title: string;
  text: string;
  author: string | null;
  authorCountry: string | null;
  authorLocation?: string | null;   // free-text place; not necessarily a country
  cabin: string | null;
  typeTraveller: string | null;
  route: string | null;
  aircraft: string | null;
  recommended: boolean | null;      // null where the source records no such signal
  subratings: Record<string, number> | null; // 1–5 per category
};

export type AirlineReviewStats = {
  source: string;                   // a source tag, or 'all' for the combined block
  reviewCount: number;
  avgRating10: number | null;
  recommendPct: number | null;      // null where no source in scope reports it
  subratings: Record<string, number> | null;
  firstReviewDate: string;
  lastReviewDate: string;
  sourceUrl?: string | null;        // where these reviews were originally published
};

export type AirlineReviewFile = {
  slug: string;
  sources: string[];
  stats: AirlineReviewStats;                       // combined across every source
  statsBySource?: Record<string, AirlineReviewStats>;
  reviews: AirlineReview[];
};

export const SUBRATING_LABELS: Record<string, string> = {
  seatComfort: 'Seat comfort',
  cabinStaff: 'Cabin staff',
  foodBeverages: 'Food & beverages',
  inflightEntertainment: 'In-flight entertainment',
  groundService: 'Ground service',
  wifiConnectivity: 'Wi-Fi',
  valueMoney: 'Value for money',
};

/**
 * Display metadata per source tag. Attribution is rendered from this, so a file
 * carrying reviews from two sources credits both rather than whichever adapter
 * happened to write it last.
 */
export const SOURCE_META: Record<string, { label: string; home: string }> = {
  'skytrax-kaggle': { label: 'Skytrax', home: 'https://www.airlinequality.com/' },
  tripadvisor: { label: 'TripAdvisor', home: 'https://www.tripadvisor.com/' },
};

export function sourceLabel(source: string): string {
  return SOURCE_META[source]?.label ?? source;
}

const DIR = path.join(process.cwd(), 'content', 'airline-reviews');

export function getAirlineReviews(slug: string): AirlineReviewFile | null {
  try {
    const raw = fs.readFileSync(path.join(DIR, `${slug}.json`), 'utf8');
    return JSON.parse(raw) as AirlineReviewFile;
  } catch {
    return null;
  }
}
