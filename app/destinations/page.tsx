import { listDestinations, mediaUrl } from '@/lib/strapi';
import DestinationsDirectory from '@/components/DestinationsDirectory';
import ExpandableDescription from '@/components/ExpandableDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';
import { Suspense } from 'react';

export const revalidate = 60;

const HUB = HUB_INTROS.destinations;
const PATH = HUB_PATHS.destinations;

export const metadata = {
  title: 'Destinations',
  description: HUB.description,
  alternates: { canonical: PATH },
};

export default async function DestinationsPage() {
  const destinations = await listDestinations().catch(() => []);

  const collectionJsonLd = collectionPageJsonLd({
    name: HUB.name,
    description: HUB.description,
    url: PATH,
    itemListName: 'Destinations',
    items: destinations.map((d) => ({
      name: d.name,
      url: `/destinations/${d.slug}`,
      image: mediaUrl(d.heroImage ?? null),
    })),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-16" data-testid="destinations-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header className="max-w-3xl">
        <p className="chip">Places</p>
        <h1 className="editorial-h mt-5 text-3xl font-bold text-forest-900">
          Where we've been
        </h1>
        <p className="mt-5 text-xl text-ink/70">
          {destinations.length} destinations and counting. Browse by continent, country, or city — or search for somewhere specific.
        </p>
        <ExpandableDescription text={HUB.intro} />
      </header>

      <Suspense>
        <DestinationsDirectory destinations={destinations} />
      </Suspense>
    </div>
  );
}
