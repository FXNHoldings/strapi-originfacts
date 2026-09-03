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

  const carouselSlides: Tier1GuideSlide[] = [...PUBLISHED_AIRLINE_GUIDES]
    .map((slug) => {
      const airline = bySlug.get(slug);
      if (!airline) return null;
      const destinations = getRouteFacts(airline.iataCode)?.destinationCount ?? 0;
      // Display ONLY Tier 1 Airlines in the Featured Policy Guides carousel
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
    .filter((s): s is Tier1GuideSlide => s !== null);

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
    <div className="mx-auto max-w-7xl px-6 py-16" data-testid="airlines-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header>
        <h1 className="editorial-h text-3xl font-bold text-forest-900">Airlines — Travel Directory</h1>
        <ExpandableDescription text={HUB.intro} />
      </header>

      {/* Auto-sliding Tier 1 Featured Airline Guides section below title & description */}
      <Tier1AirlineCarousel slides={carouselSlides} />

      <AirlineDirectory airlines={airlines} publishedSlugs={Array.from(PUBLISHED_AIRLINE_GUIDES)} />
    </div>
  );
}
