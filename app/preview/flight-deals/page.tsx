import type { Metadata } from 'next';
import FlightDealsPreviewClient from './FlightDealsPreviewClient';
import { listRoutes } from '@/lib/strapi';

export const metadata: Metadata = {
  title: 'Flight Deals — Google Flights Deals (BETA) Preview',
  description: 'Interactive SerpApi Google Flights Deals API preview matching Google Travel layout.',
  robots: { index: false, follow: false },
};

export default async function FlightDealsPreviewPage() {
  const routes = await listRoutes().catch(() => []);
  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24 text-slate-900" data-testid="flight-deals-preview">
      <FlightDealsPreviewClient routes={routes} />
    </div>
  );
}
