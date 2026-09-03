import type { Metadata } from 'next';
import { listAirlines, mediaUrl } from '@/lib/strapi';
import { PUBLISHED_AIRLINE_GUIDES, airlineGuideIsPublished, airlineTier } from '@/lib/airline-tier';
import { getRouteFacts } from '@/lib/route-facts';
import { getAirlineFacts } from '@/lib/airline-facts';
import AirlineDirectory from '@/components/AirlineDirectory';
import Tier1AirlineCarousel, { type Tier1GuideSlide } from '@/components/Tier1AirlineCarousel';
import ExpandableDescription from '@/components/ExpandableDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';

export const revalidate = 60;

const HUB = HUB_INTROS.airlines;
const PATH = HUB_PATHS.airlines;

// Top global airlines ordered by priority for Featured Policy Guides
const TOP_PRIORITY_SLUGS = [
  'qantas',
  'singapore-airlines',
  'qatar-airways',
  'emirates',
  'united-airlines',
  'delta-air-lines',
  'american-airlines',
  'british-airways',
  'lufthansa',
  'air-france',
  'klm-royal-dutch-airlines',
  'cathay-pacific',
  'all-nippon-airways',
  'japan-airlines',
  'air-canada',
  'air-new-zealand',
  'virgin-australia',
  'turkish-airlines',
  'etihad-airways',
  'finnair',
  'korean-air',
  'asiana-airlines',
  'eva-air',
  'fiji-airways',
  'virgin-atlantic',
  'jetblue',
  'southwest-airlines',
  'alaska-airlines',
  'ryanair',
  'easyjet',
];

export const metadata: Metadata = {
  title: 'Airline Directory — Search Carriers & Verified Guides | OriginFacts',
  description: HUB.description,
  alternates: { canonical: PATH },
  robots: { index: true, follow: true },
};

export default async function AirlinesPage() {
  const allAirlines = await listAirlines().catch(() => []);
  const airlines = allAirlines.filter((a) => {
    const dests = getRouteFacts(a.iataCode)?.destinationCount ?? 0;
    return airlineGuideIsPublished(a.slug) || airlineTier(a, dests > 0) <= 2;
  });

  const bySlug = new Map(allAirlines.map((a) => [a.slug, a]));

  // Build slides and sort top priority global carriers first
  const carouselSlides: Tier1GuideSlide[] = Array.from(PUBLISHED_AIRLINE_GUIDES)
    .map((slug) => {
      const airline = bySlug.get(slug);
      if (!airline) return null;
      const destinations = getRouteFacts(airline.iataCode)?.destinationCount ?? 0;
      // Display Tier 1 & verified policy guide airlines in Featured section
      if (airlineTier(airline, destinations > 0) !== 1) return null;

      const facts = getAirlineFacts(slug);
      const verifiedFields = facts
        ? facts.modules.reduce(
            (total, m) => total + Object.values(m.fields ?? {}).filter((f) => f.status === 'official').length,
            0,
          )
        : 0;
      return {
        airline,
        verifiedFields,
        destinations,
        homeCountry: airline.country || 'International',
      };
    })
    .filter((s): s is Tier1GuideSlide => s !== null)
    .sort((a, b) => {
      const indexA = TOP_PRIORITY_SLUGS.indexOf(a.airline.slug);
      const indexB = TOP_PRIORITY_SLUGS.indexOf(b.airline.slug);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return b.verifiedFields - a.verifiedFields;
    });

  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: HUB.description,
    url: PATH,
    itemListName: 'Airlines',
    items: airlines.map((a) => ({
      name: a.iataCode ? `${a.name} (${a.iataCode})` : a.name,
      url: `/airlines/${a.slug}`,
      image: mediaUrl(a.logo ?? null),
    })),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16" data-testid="airlines-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      {/* Redesigned Hero Header Section */}
      <header className="relative overflow-hidden rounded-3xl border border-forest-900/10 bg-gradient-to-br from-forest-900/[0.04] via-emerald-900/[0.02] to-sand-100/50 p-8 sm:p-12 shadow-sm">
        <div className="relative z-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-900 px-3 py-1 font-mono text-xs font-bold text-sand-100 shadow-xs">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Global Airline Directory
            </span>
            <span className="rounded-full bg-emerald-700/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-800 border border-emerald-700/20">
              Verified Policy Database
            </span>
          </div>

          <h1 className="editorial-h mt-4 text-3xl sm:text-5xl font-bold tracking-tight text-forest-900 leading-[1.15]">
            Airline Policy Directory & Carrier Guides
          </h1>

          <div className="mt-4 text-base sm:text-lg leading-relaxed text-forest-900/80">
            <ExpandableDescription text={HUB.intro} />
          </div>
        </div>
      </header>

      {/* Auto-sliding & Tabbed Featured Policy Guides section */}
      <Tier1AirlineCarousel slides={carouselSlides} />

      {/* Main Directory & Search Grid */}
      <AirlineDirectory airlines={airlines} publishedSlugs={Array.from(PUBLISHED_AIRLINE_GUIDES)} />
    </div>
  );
}

