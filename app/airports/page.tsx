import { listAirports, mediaUrl } from '@/lib/strapi';
import AirportDirectory from '@/components/AirportDirectory';
import ExpandableDescription from '@/components/ExpandableDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';
import { airportPath } from '@/lib/airport-slugs';

export const revalidate = 60;

const HUB = HUB_INTROS.airports;
const PATH = HUB_PATHS.airports;

export const metadata = {
  title: 'Airport Directory',
  description: HUB.description,
  alternates: { canonical: PATH },
  // Temporarily noindexed for AdSense review — see AIRPORTS_INDEXABLE.
  robots: { index: false, follow: true },
};

export default async function AirportsPage() {
  const airports = await listAirports().catch(() => []);

  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: HUB.description,
    url: PATH,
    itemListName: 'Airports',
    items: airports.map((a) => ({
      name: a.city ? `${a.name} (${a.iata}) — ${a.city}` : `${a.name} (${a.iata})`,
      url: airportPath(a, airports),
      image: mediaUrl(a.heroImage ?? null),
    })),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-16" data-testid="airports-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header>
        <h1 className="editorial-h text-3xl font-bold text-forest-900">Airports — Travel Directory</h1>
        <ExpandableDescription text={HUB.intro} />
      </header>

      <AirportDirectory airports={airports} />
    </div>
  );
}
