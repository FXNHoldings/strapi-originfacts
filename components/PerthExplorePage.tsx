import Link from 'next/link';
import {
  fetchSerpapiExplore,
  fetchTravelpayoutsExplore,
  type ExploreFare,
  type ExploreResult,
} from '@/lib/explore';
import { listAirports } from '@/lib/strapi';
import { SITE_URL, articleBlogPostingJsonLd } from '@/lib/entity-seo';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/SeoBlocks';

const PERTH_IATA = 'PER';

type ExploreSource = 'serpapi' | 'travelpayouts';

export type ExploreVariant =
  | { kind: 'all'; }                                        // top 20 cheapest
  | { kind: 'month'; monthIndex: number; monthLabel: string }  // 1..12
  | { kind: 'budget'; maxPrice: number }
  | { kind: 'duration'; tripLength: number; label: string }
  | { kind: 'non-stop'; };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const ALL_MONTH_SLUGS = MONTHS.map((m) => m.toLowerCase());

export default async function PerthExplorePage({
  variant,
  title,
  intro,
  source = 'serpapi',
}: {
  variant: ExploreVariant;
  title: string;
  intro: string;
  source?: ExploreSource;
}) {
  let result: ExploreResult;

  if (source === 'travelpayouts') {
    // Pull every cached destination + an IATA → "City, Country" label map
    // from the Strapi airport list, so TP IATA codes can be displayed as
    // human-readable destinations.
    const [tpResult, airports] = await Promise.all([
      fetchTravelpayoutsExplore({
        originIata: PERTH_IATA,
        countryDestinationIatas: [],
      }),
      listAirports().catch(() => []),
    ]);
    const labels = new Map<string, string>();
    for (const a of airports) {
      if (!a.iata) continue;
      const label = [a.city ?? a.name, a.country].filter(Boolean).join(', ');
      labels.set(a.iata.toUpperCase(), label || a.iata);
    }
    let fares = tpResult.fares.map((f) => ({
      ...f,
      destinationName: (f.destinationIata && labels.get(f.destinationIata)) || f.destinationName,
    }));

    // Apply variant filters client-side (TP doesn't accept these as query
    // params on city-directions).
    if (variant.kind === 'budget') {
      fares = fares.filter((f) => f.priceMinor <= variant.maxPrice);
    }
    if (variant.kind === 'non-stop') {
      // TP's `transfers` field came back on the raw response; we infer
      // non-stop status from the airline + a 0-stop heuristic via the booking
      // URL not being constructible. Easier: TP only flags `transfers=0` as
      // direct, and we encoded that already at fetch time — non-stop pages
      // should hit the raw row's `transfers` field. Re-pull with the raw
      // sample for accuracy.
      const raw = (tpResult.rawSample ?? {}) as Record<string, { transfers?: number }>;
      fares = fares.filter((f) => {
        if (!f.destinationIata) return true;
        const t = raw[f.destinationIata]?.transfers;
        return t === 0;
      });
    }
    if (variant.kind === 'duration') {
      fares = fares.filter((f) => {
        if (!f.departureDate || !f.returnDate) return false;
        const days = Math.round(
          (new Date(f.returnDate).getTime() - new Date(f.departureDate).getTime()) /
            (24 * 60 * 60 * 1000),
        );
        // Within ±1 day of the target — TP cached fares rarely match exactly.
        return Math.abs(days - variant.tripLength) <= 1;
      });
    }
    if (variant.kind === 'month') {
      fares = fares.filter((f) => {
        if (!f.departureDate) return false;
        return Number(f.departureDate.slice(5, 7)) === variant.monthIndex;
      });
    }

    fares.sort((a, b) => a.priceMinor - b.priceMinor);
    result = { ...tpResult, fares: fares.slice(0, 20) };
  } else {
    const fetchOpts: Parameters<typeof fetchSerpapiExplore>[0] = {
      originIata: PERTH_IATA,
      limit: 20,
    };
    if (variant.kind === 'month') fetchOpts.monthIndex = variant.monthIndex;
    if (variant.kind === 'budget') fetchOpts.maxPrice = variant.maxPrice;
    if (variant.kind === 'duration') fetchOpts.tripLength = variant.tripLength;
    if (variant.kind === 'non-stop') fetchOpts.maxStops = 0;
    result = await fetchSerpapiExplore(fetchOpts);
  }

  const articleSchema = articleBlogPostingJsonLd({
    headline: title,
    description: intro,
    url: `${SITE_URL}/flights-from-perth`,
    authorNameOrSlug: 'kritin-vashist',
    categoryName: 'Flights',
    type: 'BlogPosting',
  });

  const breadcrumbs = breadcrumbJsonLd(
    title === 'Flights from Perth'
      ? [{ name: 'Flights from Perth', url: '/flights-from-perth' }]
      : [
          { name: 'Flights from Perth', url: '/flights-from-perth' },
          { name: title, url: '/flights-from-perth' },
        ]
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-16" data-testid="perth-explore">
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbs} />
      <header>
        <p className="text-xs uppercase tracking-widest text-forest-900/55">
          Flights from Perth (PER)
        </p>
        <h1 className="editorial-h mt-2 text-3xl font-bold text-forest-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-base text-forest-900/75">{intro}</p>
      </header>

      <FilterNav active={variant} source={source} />

      <section className="mt-10" data-testid="perth-explore-fares">
        {!result.ok && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {result.error?.includes('SERPAPI_API_KEY') ? (
              <>
                <strong>SerpAPI key not configured.</strong> Add{' '}
                <code className="font-mono">SERPAPI_API_KEY=…</code> to{' '}
                <code className="font-mono">.env.local</code> and restart the container. Get a key
                at <a href="https://serpapi.com" className="underline" target="_blank" rel="noopener noreferrer">serpapi.com</a>.
              </>
            ) : (
              <>Couldn&apos;t load fares: {result.error}</>
            )}
          </div>
        )}

        {result.ok && result.fares.length === 0 && (
          <p className="text-sm text-forest-900/65">
            No fares matched these filters. Try widening the budget or removing the non-stop constraint.
          </p>
        )}

        {result.ok && result.fares.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.fares.map((f, i) => (
              <FareCard key={`${f.destinationName}-${i}`} fare={f} />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-12 border-t border-forest-900/10 pt-6 text-xs text-forest-900/55">
        {source === 'travelpayouts' ? (
          <>
            Fares pulled from <strong>TravelPayouts</strong> Data API · cached for 1 hour · prices
            are typical economy round-trip from Perth (PER) in USD · click any card to open
            Aviasales with your affiliate marker pre-applied.
          </>
        ) : (
          <>
            Fares pulled from <strong>Google Travel Explore</strong> via SerpAPI · cached for 24 h ·
            prices are typical economy round-trip from Perth (PER) in USD · click any card to open
            Google Flights with the search pre-filled.
          </>
        )}
      </footer>
    </main>
  );
}

function FareCard({ fare }: { fare: ExploreFare }) {
  const dates = [fare.departureDate, fare.returnDate].filter(Boolean).join(' → ');
  return (
    <a
      href={fare.bookingUrl ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-[0.3rem] border border-forest-900/10 bg-paper transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
      data-testid={`perth-fare-${fare.destinationName.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {fare.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fare.imageUrl}
          alt={fare.destinationName}
          className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
      )}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="font-urbanist text-base font-bold leading-snug text-forest-900 group-hover:text-forest-700">
            {fare.destinationName}
          </h3>
          {dates && (
            <p className="mt-1 text-xs text-forest-900/55">{dates}</p>
          )}
          {fare.airline && (
            <p className="mt-1 text-xs text-forest-900/55">{fare.airline}</p>
          )}
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="font-urbanist text-2xl font-bold text-forest-900">
            ${fare.priceMinor.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-forest-700 group-hover:underline">Search →</span>
        </div>
      </div>
    </a>
  );
}

function FilterNav({ active, source }: { active: ExploreVariant; source: ExploreSource }) {
  const base = source === 'travelpayouts' ? '/flights-from-perth-tp' : '/flights-from-perth';
  const chips: { label: string; href: string; on: boolean }[] = [
    { label: 'All',          href: `${base}/cheap-destinations`, on: active.kind === 'all' },
    { label: 'Non-stop',     href: `${base}/non-stop`,           on: active.kind === 'non-stop' },
    { label: 'Under $800',   href: `${base}/under-800`,          on: active.kind === 'budget' && active.maxPrice === 800 },
    { label: 'Under $1,500', href: `${base}/under-1500`,         on: active.kind === 'budget' && active.maxPrice === 1500 },
    { label: 'Weekend',      href: `${base}/weekend-trips`,      on: active.kind === 'duration' && active.tripLength === 3 },
    { label: 'Two-week',     href: `${base}/two-week-trips`,     on: active.kind === 'duration' && active.tripLength === 14 },
  ];
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2" data-testid="perth-explore-filters">
      <span className="text-xs uppercase tracking-widest text-forest-900/50">Filters:</span>
      {chips.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className={
            'rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider transition ' +
            (c.on
              ? 'border-forest-900 bg-forest-900 text-sand-100'
              : 'border-forest-900/20 text-forest-900/80 hover:border-forest-900/40 hover:bg-forest-900/5')
          }
        >
          {c.label}
        </Link>
      ))}
      <details className="ml-2 text-xs text-forest-900/80">
        <summary className="cursor-pointer rounded-full border border-forest-900/20 px-3 py-1 font-medium uppercase tracking-wider hover:border-forest-900/40 hover:bg-forest-900/5">
          By month ↓
        </summary>
        <div className="absolute z-10 mt-2 grid grid-cols-3 gap-1 rounded-md border border-forest-900/15 bg-white p-2 shadow-md">
          {MONTHS.map((m, i) => {
            const slug = m.toLowerCase();
            const on = active.kind === 'month' && active.monthIndex === i + 1;
            return (
              <Link
                key={m}
                href={`${base}/cheap-destinations/${slug}`}
                className={
                  'rounded px-3 py-1.5 text-center font-medium normal-case tracking-normal transition ' +
                  (on
                    ? 'bg-forest-900 text-sand-100'
                    : 'text-forest-900 hover:bg-forest-900/5')
                }
              >
                {m}
              </Link>
            );
          })}
        </div>
      </details>
    </div>
  );
}
