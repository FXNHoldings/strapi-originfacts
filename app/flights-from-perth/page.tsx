import Link from 'next/link';
import { SITE_URL, articleBlogPostingJsonLd } from '@/lib/entity-seo';
import { JsonLd } from '@/components/SeoBlocks';
import type { Metadata } from 'next';

import { breadcrumbJsonLd } from '@/lib/jsonld';
import ComparisonTable from '@/components/ComparisonTable';

export const metadata: Metadata = {
  title: 'Flights from Perth — Cheap Destinations Explorer',
  description: 'Where can you fly from Perth? Cheapest destinations, monthly views, budget tiers, weekend trips, and non-stop only — refreshed daily.',
  alternates: { canonical: '/flights-from-perth' },
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PerthExploreIndex() {
  const articleSchema = articleBlogPostingJsonLd({
    headline: 'Flights from Perth — Cheap Destinations Explorer',
    description: 'Where can you fly from Perth? Cheapest destinations, monthly views, budget tiers, weekend trips, and non-stop only — refreshed daily.',
    url: `${SITE_URL}/flights-from-perth`,
    authorNameOrSlug: 'kritin-vashist',
    categoryName: 'Flights',
    type: 'BlogPosting',
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-16" data-testid="perth-explore-index">
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Flights from Perth', url: '/flights-from-perth' }])} />
      <header>
        <p className="text-xs uppercase tracking-widest text-forest-900/55">Flights from Perth (PER)</p>
        <h1 className="editorial-h mt-2 text-3xl font-bold text-forest-900 sm:text-4xl">
          Where can I fly from Perth?
        </h1>
        <p className="mt-3 max-w-3xl text-base text-forest-900/75">
          Finding cheap flights from Perth (PER) requires comparing seasonal destination fare drops, non-stop flight availability, and flexible trip durations across domestic and international carriers. Our interactive explorer aggregates live airfare data updated every 24 hours, allowing travelers to filter affordable destinations by monthly travel windows, budget thresholds, and direct booking links.
        </p>
      </header>

      <Section title="Which flight categories can you browse from Perth?" testid="category-tiles">
        <Tile href="/flights-from-perth/cheap-destinations" label="Top 20 cheapest now" />
        <Tile href="/flights-from-perth/non-stop" label="Non-stop only" />
        <Tile href="/flights-from-perth/under-800" label="Under $800" />
        <Tile href="/flights-from-perth/under-1500" label="Under $1,500" />
        <Tile href="/flights-from-perth/weekend-trips" label="Weekend trips" />
        <Tile href="/flights-from-perth/two-week-trips" label="Two-week trips" />
      </Section>

      <Section title="When is the cheapest month to fly from Perth?" testid="month-tiles">
        {MONTHS.map((m) => (
          <Tile
            key={m}
            href={`/flights-from-perth/cheap-destinations/${m.toLowerCase()}`}
            label={m}
          />
        ))}
      </Section>

      <div className="mt-12">
        <ComparisonTable
          caption="Perth (PER) Flight Options vs Popular Destinations Comparison"
          head={['Destination Region', 'Direct Non-Stop Carriers', 'Typical Flight Duration', 'Budget Fare Range (Return)', 'Best Travel Window']}
          rows={[
            ['Southeast Asia (Bali / Singapore / Bangkok)', 'Batik Air, AirAsia, Jetstar, SQ', '3.5 hrs - 7 hrs', 'A$280 - A$650', 'Dry Season (Apr - Oct)'],
            ['East Asia (Tokyo / Hong Kong)', 'ANA, Cathay Pacific, Qantas', '9.5 hrs - 10.5 hrs', 'A$750 - A$1,200', 'Spring & Autumn (Mar - May, Sep - Nov)'],
            ['Europe (London / Paris / Rome)', 'Qantas (Non-Stop), Qatar, Emirates', '17.5 hrs (Direct) - 21 hrs', 'A$1,350 - A$2,100', 'Shoulder Season (May & Sep)'],
            ['Domestic Australia (Sydney / Melbourne)', 'Qantas, Virgin Australia, Jetstar', '3.5 hrs - 4 hrs', 'A$220 - A$480', 'Year-Round'],
          ]}
        />
      </div>

      <footer className="mt-12 border-t border-forest-900/10 pt-6 text-xs text-forest-900/55">
        Data pulled from Google Travel Explore via SerpAPI. One API call per page; results cached
        for 24 hours. Add <code className="font-mono">SERPAPI_API_KEY</code> to{' '}
        <code className="font-mono">.env.local</code> to enable live fare data.
      </footer>
    </main>
  );
}

function Section({
  title,
  testid,
  children,
}: {
  title: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10" data-testid={testid}>
      <h2 className="editorial-h text-[1.5rem] font-bold text-forest-900">{title}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function Tile({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-[0.3rem] border border-forest-900/10 bg-forest-900/[0.02] px-4 py-3 font-urbanist text-base font-bold text-forest-900 transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:bg-paper"
    >
      <span className="group-hover:text-forest-700">{label}</span>
      <span aria-hidden className="text-forest-900/40 group-hover:text-forest-700">→</span>
    </Link>
  );
}
