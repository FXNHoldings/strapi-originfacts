import type { Metadata } from 'next';
import { listAirlines, mediaUrl } from '@/lib/strapi';
import { PUBLISHED_AIRLINE_GUIDES, airlineGuideIsPublished, airlineTier } from '@/lib/airline-tier';
import { getRouteFacts } from '@/lib/route-facts';
import { getAirlineFacts } from '@/lib/airline-facts';
import AirlineDirectory from '@/components/AirlineDirectory';
import Tier1AirlineCarousel, { type Tier1GuideSlide } from '@/components/Tier1AirlineCarousel';
import CategoryDescription from '@/components/CategoryDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';
import { SECTIONS } from '@/lib/sections';
import Link from 'next/link';

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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-6 py-12 sm:py-16" data-testid="airlines-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header data-testid="airlines-header">
        <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-12">
          <div className="min-w-0">
            <h1 className="font-urbanist text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              Airlines
            </h1>
            <CategoryDescription text={HUB.intro} />
          </div>
          <div
            className="flex h-32 w-32 flex-col items-center justify-center rounded-[0.3rem] bg-[#f1f5f9] text-forest-950"
            data-testid="airlines-count"
          >
            <span className="font-urbanist text-4xl font-bold leading-none">{airlines.length.toLocaleString()}</span>
            <span className="mt-2 font-urbanist text-[11px] font-bold uppercase tracking-widest text-forest-900/70">
              Airlines
            </span>
          </div>
        </div>

        <nav
          className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-forest-900/15 py-4 font-urbanist text-[14px] font-bold uppercase tracking-widest text-forest-950"
          aria-label="Categories"
          data-testid="airlines-subnav"
        >
          {[
            ...SECTIONS.filter((s) => s.slug !== 'destinations').map((s) => ({
              href: `/category/${s.slug}`,
              slug: s.slug,
              name: s.title,
            })),
            { href: '/airlines', slug: 'airlines', name: 'Airlines' },
            { href: '/airports', slug: 'airports', name: 'Airports' },
          ].map((item) => (
            <Link
              key={item.slug}
              href={item.href}
              className={`transition hover:text-primary-emphasis ${
                item.slug === 'airlines' ? 'text-primary-emphasis' : ''
              }`}
              aria-current={item.slug === 'airlines' ? 'page' : undefined}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </header>

      {/* Auto-sliding & Tabbed Featured Policy Guides section */}
      <Tier1AirlineCarousel slides={carouselSlides} />

      {/* Main Directory & Search Grid */}
      <AirlineDirectory airlines={airlines} publishedSlugs={Array.from(PUBLISHED_AIRLINE_GUIDES)} />
    </div>
  );
}
