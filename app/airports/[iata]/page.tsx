import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getAirport,
  listRoutesFromAirport,
  listAirportsByCountryCode,
  mediaUrl,
} from '@/lib/strapi';
import {
  SITE_URL,
  airportIsSubstantive,
  airportIntro,
  airportFaqs,
  airportJsonLd,
  faqJsonLd,
  robotsFor,
  summariseRoutes,
} from '@/lib/entity-seo';
import { JsonLd, FaqSection } from '@/components/SeoBlocks';
import type { Metadata } from 'next';

export const revalidate = 60;

type Props = { params: Promise<{ iata: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { iata } = await params;
  const a = await getAirport(iata);
  if (!a) return { title: 'Airport not found', robots: { index: false, follow: false } };
  const routes = await listRoutesFromAirport(a.iata, 1).catch(() => []);
  return {
    title: `${a.name} (${a.iata}) — airport guide`,
    description:
      a.about?.slice(0, 150) ||
      `${a.name} (${a.iata})${a.city ? ` in ${a.city}` : ''}${a.country ? `, ${a.country}` : ''}: codes, location, airlines, top destinations and ground-transfer basics.`,
    alternates: { canonical: `${SITE_URL}/airports/${a.iata.toLowerCase()}` },
    robots: robotsFor(airportIsSubstantive(a, routes.length > 0)),
  };
}

export default async function AirportPage({ params }: Props) {
  const { iata } = await params;
  const airport = await getAirport(iata);
  if (!airport) notFound();

  const [routes, sameCountry] = await Promise.all([
    listRoutesFromAirport(airport.iata, 15).catch(() => []),
    airport.countryCode
      ? listAirportsByCountryCode(airport.countryCode, 30).catch(() => [])
      : Promise.resolve([]),
  ]);
  const summary = summariseRoutes(routes, 'destination');
  const hero = mediaUrl(airport.heroImage ?? null);
  const url = `${SITE_URL}/airports/${airport.iata.toLowerCase()}`;

  const nearby = sameCountry.filter((a) => a.iata && a.iata !== airport.iata).slice(0, 9);

  const facts: { label: string; value?: string | null }[] = [
    { label: 'IATA code', value: airport.iata },
    { label: 'ICAO code', value: airport.icao },
    { label: 'City', value: airport.city },
    { label: 'Country', value: airport.country },
    { label: 'Region', value: airport.region },
    {
      label: 'Coordinates',
      value:
        typeof airport.latitude === 'number' && typeof airport.longitude === 'number'
          ? `${airport.latitude.toFixed(3)}°, ${airport.longitude.toFixed(3)}°`
          : null,
    },
    { label: 'Time zone', value: airport.timezone },
  ];

  const faqs = airportFaqs(airport, summary);

  // Split the `about` into prose (left column) and the "Airport information"
  // detail block (right column). Country/Region are already in `facts`, so
  // we drop those duplicates and keep the contact rows (postal, phone, website).
  const aboutSections = airport.about ? parseAboutSections(airport.about) : [];
  const infoSection = aboutSections.find((s) => /airport information/i.test(s.heading || ''));
  const proseSections = aboutSections.filter((s) => s !== infoSection);
  const contactRows = infoSection
    ? parseInfoRows(infoSection).filter((r) => !/^(country|region)/i.test(r.label))
    : [];

  return (
    <article data-testid={`airport-page-${airport.iata}`}>
      <JsonLd data={airportJsonLd(airport, url)} />
      <JsonLd data={faqJsonLd(faqs)} />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl px-6 pt-10">
        <nav className="text-xs uppercase tracking-widest text-forest-900/60">
          <Link href="/airports" className="hover:text-forest-900">Airports</Link>
          <span className="mx-2 text-forest-900/30">/</span>
          <span className="text-forest-900/80">{airport.iata}</span>
        </nav>
      </div>

      {/* Hero */}
      <header className="relative mx-auto mt-6 max-w-7xl overflow-hidden rounded-[0.3rem]">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt={airport.name} className="h-[320px] w-full object-cover" />
        ) : (
          <div className="h-[240px] w-full bg-gradient-to-br from-forest-900 to-forest-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950/85 via-forest-950/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-8 pb-8 text-sand-100">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest opacity-80">
            <span>{airport.region}</span>
            {airport.country && <span>· {airport.country}</span>}
            {airport.timezone && <span>· {airport.timezone}</span>}
          </div>
          <h1 className="editorial-h mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl">
            {airport.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-xs">
            <span className="rounded-[0.3rem] bg-forest-950/80 px-3 py-1.5 font-bold tracking-wider">
              IATA · {airport.iata}
            </span>
            {airport.icao && (
              <span className="rounded-[0.3rem] border border-sand-100/30 px-3 py-1.5 font-bold tracking-wider">
                ICAO · {airport.icao}
              </span>
            )}
            {airport.city && <span className="opacity-80">Serving {airport.city}</span>}
          </div>
        </div>
      </header>

      {/* Overview — about prose (left) + Airport information panel (right) */}
      <section className="mx-auto mt-14 max-w-7xl px-6" data-testid="airport-overview">
        <div className="grid gap-10 lg:grid-cols-[6fr_3fr]">
          {/* Left: about airport content */}
          <div>
            <p className="section-eyebrow">
              <span className="inline-block h-px w-8 bg-forest-800/60" />
              About {airport.name}
            </p>
            <div className="prose-article mt-4">
              {proseSections.length > 0 ? (
                proseSections.map((s, i) =>
                  s.heading ? (
                    <div key={i} className="mt-8">
                      <h3 className="font-urbanist text-xl font-bold text-forest-900">{s.heading}</h3>
                      {s.paragraphs.map((p, j) => (
                        <p key={j} className="mt-3">{p}</p>
                      ))}
                    </div>
                  ) : (
                    s.paragraphs.map((p, j) => <p key={`${i}-${j}`}>{p}</p>)
                  ),
                )
              ) : (
                <p>{airportIntro(airport, summary)}</p>
              )}
            </div>
          </div>

          {/* Right: Airport information (codes, location, contact) */}
          <aside className="rounded-[0.3rem] border border-forest-900/10 bg-forest-900/[0.02] p-6 lg:self-start">
            <h3 className="editorial-h text-xs font-bold uppercase tracking-wider text-forest-900/60">
              Airport information
            </h3>
            <dl className="mt-5 space-y-4">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-[11px] uppercase tracking-widest text-forest-900/50">{f.label}</dt>
                  <dd className="mt-1 text-sm font-light text-forest-900">
                    {f.value ?? <span className="text-forest-900/30">—</span>}
                  </dd>
                </div>
              ))}
              {contactRows.map((r) => (
                <div key={r.label}>
                  <dt className="text-[11px] uppercase tracking-widest text-forest-900/50">{r.label}</dt>
                  <dd className="mt-1 break-words text-sm font-light text-forest-900">
                    <ContactValue label={r.label} value={r.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      {/* Airlines operating from here (derived from tracked routes) */}
      {summary.carriers.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-6" data-testid="airport-airlines">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-3xl">
              Airlines flying from {airport.iata}
            </h2>
            <span className="text-sm font-light text-forest-900/50">
              {summary.carriers.length} carrier{summary.carriers.length === 1 ? '' : 's'}
            </span>
          </header>
          <div className="mt-6 flex flex-wrap gap-2">
            {summary.carriers.map((c) => (
              <Link
                key={c.slug}
                href={`/airlines/${c.slug}`}
                className="rounded-[0.3rem] border border-forest-900/10 bg-paper px-3 py-1.5 text-sm text-forest-900 transition hover:border-forest-900/30 hover:text-forest-700"
              >
                {c.name}
                {c.iataCode && <span className="ml-1.5 font-mono text-xs text-forest-900/50">{c.iataCode}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top routes from here */}
      <section className="mx-auto mt-16 max-w-7xl px-6">
        <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
          <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-3xl">
            Top routes from {airport.iata}
          </h2>
          <span className="text-sm font-light text-forest-900/50">
            {routes.length} route{routes.length === 1 ? '' : 's'}
          </span>
        </header>
        {routes.length === 0 ? (
          <p className="mt-10 text-forest-900/60">
            No routes tracked from {airport.iata} yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((r) => (
              <Link
                key={r.id}
                href={`/flight-routes/${r.slug}`}
                className="group flex items-center justify-between rounded-[0.3rem] border border-forest-900/10 bg-paper p-5 transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
              >
                <div>
                  <div className="font-mono text-xs font-bold tracking-wider text-forest-900/70">
                    {r.origin?.iata} → {r.destination?.iata}
                  </div>
                  <div className="mt-2 font-urbanist text-base font-bold text-forest-900 group-hover:text-forest-700">
                    {r.destination?.city || r.destination?.name}
                  </div>
                  <div className="mt-1 text-xs text-forest-900/60">
                    {r.destination?.country}
                  </div>
                </div>
                {r.distanceKm && (
                  <div className="text-right text-xs text-forest-900/50">
                    <div className="font-mono font-bold text-forest-900/70">
                      {r.distanceKm.toLocaleString()} km
                    </div>
                    {r.durationMinutes && (
                      <div className="mt-1">{formatDuration(r.durationMinutes)}</div>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Other airports in the same country */}
      {nearby.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-6" data-testid="airport-nearby">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-3xl">
              Other airports in {airport.country}
            </h2>
          </header>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {nearby.map((a) => (
              <Link
                key={a.id}
                href={`/airports/${a.iata.toLowerCase()}`}
                className="group flex items-center gap-3 rounded-[0.3rem] border border-forest-900/10 bg-paper px-4 py-3 transition hover:-translate-y-0.5 hover:border-forest-900/30"
              >
                <span className="flex-none rounded-[0.3rem] bg-forest-900 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-sand-100">
                  {a.iata}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-urbanist text-sm font-bold text-forest-900 group-hover:text-forest-700">
                    {a.city || a.name}
                  </div>
                  <div className="truncate text-xs text-forest-900/60">{a.name}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <FaqSection faqs={faqs} title={`${airport.name} — frequently asked questions`} />

      <div className="pb-20" />
    </article>
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

type AboutSection = { heading: string | null; paragraphs: string[] };

function parseAboutSections(about: string): AboutSection[] {
  const sections: AboutSection[] = [];
  let current: AboutSection = { heading: null, paragraphs: [] };
  for (const block of about.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^##\s+(.+)$/m);
    if (headingMatch && trimmed.startsWith('##')) {
      if (current.heading || current.paragraphs.length) sections.push(current);
      current = { heading: headingMatch[1].trim(), paragraphs: [] };
      const remainder = trimmed.replace(/^##\s+.+\n?/, '').trim();
      if (remainder) current.paragraphs.push(remainder);
    } else {
      current.paragraphs.push(trimmed);
    }
  }
  if (current.heading || current.paragraphs.length) sections.push(current);
  return sections;
}

/** Parse `**Label:** value` lines (markdown line-breaks) into rows. */
function parseInfoRows(section: AboutSection): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const para of section.paragraphs) {
    for (const line of para.split('\n')) {
      const m = line.trim().match(/^\*\*(.+?):\*\*\s*(.+?)\s*$/);
      if (m) rows.push({ label: m[1].trim(), value: m[2].trim() });
    }
  }
  return rows;
}

/** Render a contact value: phone as a tel link, website/URL as an external link. */
function ContactValue({ label, value }: { label: string; value: string }) {
  const isUrl = /^https?:\/\//i.test(value) || /website|url/i.test(label);
  const isPhone = /phone|tel/i.test(label);
  if (isUrl) {
    const href = value.startsWith('http') ? value : `https://${value}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="break-all text-forest-700 underline-offset-2 hover:underline"
      >
        {value.replace(/^https?:\/\//, '').replace(/\/$/, '')}
      </a>
    );
  }
  if (isPhone) {
    return (
      <a href={`tel:${value.replace(/[^0-9+]/g, '')}`} className="text-forest-700 underline-offset-2 hover:underline">
        {value}
      </a>
    );
  }
  return <>{value}</>;
}
