import fs from 'node:fs';
import path from 'node:path';

/**
 * Loader for the unified airline-review store (content/airline-reviews/*.json).
 * Files are produced by ingestion adapters — currently the Kaggle Skytrax
 * archive (scripts/ingest-skytrax-kaggle.py); later adapters (live Skytrax
 * scrape, Google, Trustpilot…) merge into the same files under their own
 * `source` tag.
 */

export type AirlineReview = {
  source: string;
  id: string;
  date: string;                     // YYYY-MM-DD
  rating10: number | null;          // Skytrax overall is out of 10
  title: string;
  text: string;
  author: string | null;
  authorCountry: string | null;
  cabin: string | null;
  typeTraveller: string | null;
  route: string | null;
  aircraft: string | null;
  recommended: boolean;
  subratings: Record<string, number> | null; // 1–5 per category
};

export type AirlineReviewStats = {
  source: string;
  reviewCount: number;
  avgRating10: number | null;
  recommendPct: number | null;
  subratings: Record<string, number> | null;
  firstReviewDate: string;
  lastReviewDate: string;
};

export type AirlineReviewFile = {
  slug: string;
  sources: string[];
  stats: AirlineReviewStats;
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

const DIR = path.join(process.cwd(), 'content', 'airline-reviews');

export function getAirlineReviews(slug: string): AirlineReviewFile | null {
  try {
    const raw = fs.readFileSync(path.join(DIR, `${slug}.json`), 'utf8');
    return JSON.parse(raw) as AirlineReviewFile;
  } catch {
    return null;
  }
}
