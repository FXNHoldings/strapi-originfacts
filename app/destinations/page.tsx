import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Destination Directory — Browse Cities, Countries & Regions | OriginFacts',
  description: HUB.description,
  alternates: { canonical: PATH },
  robots: { index: true, follow: true },
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
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8" data-testid="destinations-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header className="relative overflow-hidden rounded-3xl border border-forest-900/10 bg-gradient-to-br from-forest-900/[0.04] via-emerald-900/[0.02] to-sand-100/50 p-8 shadow-sm sm:p-12">
        <div className="relative z-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-900 px-3 py-1 font-mono text-xs font-bold text-sand-100 shadow-xs">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Global Destination Directory
            </span>
            <span className="rounded-full border border-emerald-700/20 bg-emerald-700/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-800">
              Cities, Countries & Regions
            </span>
            <span className="rounded-full border border-forest-900/10 bg-white/70 px-3 py-1 font-mono text-xs font-semibold text-forest-900/70">
              {destinations.length.toLocaleString()} Places Indexed
            </span>
          </div>

          <h1 className="editorial-h mt-4 text-3xl font-bold leading-[1.15] tracking-tight text-forest-900 sm:text-5xl">
            Destination Guides for Cities, Countries & Regions
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-relaxed text-forest-900/75 sm:text-lg">
            Browse OriginFacts by continent, country, or city, then use each destination page to connect the practical details: nearby airports, airlines, hotels, routes, and travel context.
          </p>

          <div className="mt-4 text-base leading-relaxed text-forest-900/80 sm:text-lg">
            <ExpandableDescription text={HUB.intro} />
          </div>
        </div>
      </header>

      <Suspense>
        <DestinationsDirectory destinations={destinations} />
      </Suspense>
    </div>
  );
}
