import type { Metadata } from 'next';
import { listDestinations, mediaUrl } from '@/lib/strapi';
import DestinationsDirectory from '@/components/DestinationsDirectory';
import CategoryDescription from '@/components/CategoryDescription';
import { JsonLd } from '@/components/SeoBlocks';
import { breadcrumbJsonLd, collectionPageJsonLd } from '@/lib/jsonld';
import { HUB_INTROS, HUB_PATHS } from '@/lib/hub-intros';
import { SECTIONS } from '@/lib/sections';
import Link from 'next/link';
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
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-6" data-testid="destinations-page">
      <JsonLd data={breadcrumbJsonLd([{ name: HUB.name, url: PATH }])} />
      <JsonLd data={collectionJsonLd} />

      <header data-testid="destinations-header">
        <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-12">
          <div className="min-w-0">
            <h1 className="font-urbanist text-5xl font-bold leading-none tracking-tight text-forest-950 sm:text-6xl">
              Destinations
            </h1>
            <CategoryDescription text={HUB.intro} />
          </div>
          <div
            className="flex h-32 w-32 flex-col items-center justify-center rounded-[0.3rem] bg-[#f1f5f9] text-forest-950"
            data-testid="destinations-count"
          >
            <span className="font-urbanist text-4xl font-bold leading-none">
              {destinations.length.toLocaleString()}
            </span>
            <span className="mt-2 font-urbanist text-[11px] font-bold uppercase tracking-widest text-forest-900/70">
              Places
            </span>
          </div>
        </div>

        <nav
          className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-forest-900/15 py-4 font-urbanist text-[14px] font-bold uppercase tracking-widest text-forest-950"
          aria-label="Categories"
          data-testid="destinations-subnav"
        >
          {[
            ...SECTIONS.filter((s) => s.slug !== 'destinations').map((s) => ({
              href: `/category/${s.slug}`,
              slug: s.slug,
              name: s.title,
            })),
            { href: '/destinations', slug: 'destinations', name: 'Destinations' },
            { href: '/airlines', slug: 'airlines', name: 'Airlines' },
            { href: '/airports', slug: 'airports', name: 'Airports' },
          ].map((item) => (
            <Link
              key={item.slug}
              href={item.href}
              className={`transition hover:text-primary-emphasis ${
                item.slug === 'destinations' ? 'text-primary-emphasis' : ''
              }`}
              aria-current={item.slug === 'destinations' ? 'page' : undefined}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </header>

      <section className="mt-10 grid gap-5 lg:grid-cols-3" aria-label="How to use the destination directory">
        {[
          {
            title: 'Start with the place, then check the logistics',
            text:
              'A destination page is most useful when it connects inspiration to practical travel planning. Use this directory to move from a continent or country into the cities, airports, airlines, routes, hotels, weather notes, and local planning details that shape the real trip.',
          },
          {
            title: 'Compare countries, regions, and cities',
            text:
              'OriginFacts separates destinations into regions, countries, and city pages so broad planning and specific booking research do not get mixed together. Country pages help with visas, airports, airlines, and city coverage; city pages focus more on where to stay, how to arrive, and what to read before booking.',
          },
          {
            title: 'Find travel coverage by route and context',
            text:
              'Search by destination name, country code, or region when you already know where you want to go. Browse the grouped sections when you are still deciding. The goal is to show not just a list of places, but the travel context around each one: how people get there, which hubs matter, and what planning questions come next.',
          },
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-[0.3rem] border border-forest-900/10 bg-white p-6 shadow-xs"
          >
            <h2 className="font-urbanist text-2xl font-bold leading-tight text-forest-950">
              {item.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-forest-900/70">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-[0.3rem] border border-forest-900/10 bg-[#f8fafc] p-6 sm:p-8">
        <h2 className="font-urbanist text-3xl font-bold leading-tight text-forest-950">
          What each destination guide brings together
        </h2>
        <div className="mt-4 grid gap-5 text-base leading-relaxed text-forest-900/70 md:grid-cols-2">
          <p>
            Each destination profile is designed to be more than a postcard summary. It pulls
            together nearby airports, airlines, hotel areas, route context, weather patterns,
            practical entry notes, and related stories where we have coverage. That makes the page
            useful whether you are choosing between places or checking the details for a trip you
            have already started planning.
          </p>
          <p>
            The directory also helps keep similar places distinct. A country page answers different
            questions from a city page, and a region page should help you compare options rather
            than repeat the same generic travel copy. As more articles, airport pages, and route
            profiles are published, those connections become visible here first.
          </p>
        </div>
        <div className="mt-6 border-t border-forest-900/10 pt-5">
          <h3 className="font-urbanist text-xl font-bold leading-tight text-forest-950">
            Good for early trip research
          </h3>
          <p className="mt-3 text-base leading-relaxed text-forest-900/70">
            Use the destination index before you open a booking site when you need to decide what
            kind of trip is realistic. A city with several nearby airports may be easier to reach
            than a better-known place with limited routes, while a country page can quickly show
            whether the useful travel coverage sits around one capital, a resort coast, or several
            regional gateways. That context makes the next search more focused.
          </p>
        </div>
      </section>

      <Suspense>
        <DestinationsDirectory destinations={destinations} />
      </Suspense>
    </div>
  );
}
