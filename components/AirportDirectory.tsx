'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { mediaUrl, type StrapiAirport, type AirlineRegion } from '@/lib/strapi';
import { HUB_AIRPORT_SET } from '@/lib/hub-airports';
import { airportPath } from '@/lib/airport-slugs';

const REGION_ORDER: AirlineRegion[] = ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];
const TOP_HUBS_PREVIEW = 12;

function flagEmoji(code?: string): string {
  if (!code || code.length !== 2) return '✈️';
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default function AirportDirectory({ airports }: { airports: StrapiAirport[] }) {
  const [query, setQuery] = useState('');
  const [activeRegion, setActiveRegion] = useState<AirlineRegion | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return airports.filter((a) => {
      if (activeRegion && a.region !== activeRegion) return false;
      if (!q) return true;
      const hay = [a.name, a.iata, a.icao, a.city, a.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [airports, query, activeRegion]);

  const byRegion = useMemo(() => {
    const map = new Map<AirlineRegion, StrapiAirport[]>();
    for (const a of filtered) {
      const r = (a.region || 'Asia') as AirlineRegion;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(a);
    }
    return map;
  }, [filtered]);

  const countryCount = useMemo(
    () => new Set(airports.map((a) => a.country).filter(Boolean)).size,
    [airports],
  );
  const regionCount = useMemo(
    () => new Set(airports.map((a) => a.region).filter(Boolean)).size,
    [airports],
  );

  const orderedRegions = REGION_ORDER.filter((r) => byRegion.has(r));

  const hubs = useMemo(
    () => airports.filter((a) => a.iata && HUB_AIRPORT_SET.has(a.iata.toUpperCase())),
    [airports],
  );
  const hubsPreview = useMemo(() => hubs.slice(0, TOP_HUBS_PREVIEW), [hubs]);

  return (
    <div className="mt-10">
      {/* Summary cards — matches /countries layout: content left, icon right */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Airports"
          value={airports.length.toLocaleString()}
          blurb="Every commercial field we index — major hubs, secondary city airports, and regional strips."
          icon={<RunwayIcon />}
        />
        <SummaryCard
          label="Countries"
          value={countryCount.toLocaleString()}
          blurb="Nations represented across the index, each linked to its airline and route lists."
          icon={<GlobeIcon />}
        />
        <SummaryCard
          label="Regions"
          value={regionCount.toString()}
          blurb="Six continental groupings spanning Africa to South America and the Pacific in between."
          icon={<CompassIcon />}
        />
      </div>

      {/* Top international hubs callout */}
      {hubs.length > 0 && (
        <section className="mt-10" data-testid="airport-hubs-callout">
          <header className="flex items-end justify-between border-b border-forest-900/10 pb-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-forest-900/50">Top international hubs</p>
              <h2 className="editorial-h mt-2 text-2xl font-bold text-forest-900">
                The world's busiest gateways
              </h2>
            </div>
            <Link
              href="/airports/hubs"
              className="text-sm font-medium text-forest-700 hover:underline"
            >
              View all {hubs.length} hubs →
            </Link>
          </header>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {hubsPreview.map((a) => (
              <li key={a.id}>
                <HubChip airport={a} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Search */}
      <div className="mt-10">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, IATA code (e.g. LHR), city, country…"
          className="w-full rounded-[0.3rem] border border-forest-900/15 bg-paper px-4 py-3 font-sans text-base text-ink placeholder:text-forest-900/40 focus:border-terracotta-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20"
          data-testid="airport-search"
        />
      </div>

      {/* Region filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-forest-900/50">Region:</span>
        <FilterChip
          label="All"
          active={activeRegion === null}
          onClick={() => setActiveRegion(null)}
        />
        {REGION_ORDER.map((r) => (
          <FilterChip
            key={r}
            label={r}
            active={activeRegion === r}
            onClick={() => setActiveRegion(activeRegion === r ? null : r)}
          />
        ))}
      </div>

      {/* Results */}
      <div className="mt-10 grid gap-12 lg:grid-cols-[180px,1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="mb-3 text-xs uppercase tracking-widest text-forest-900/50">Jump to</p>
            {orderedRegions.map((r) => (
              <a
                key={r}
                href={`#region-${r.replace(/\s+/g, '-').toLowerCase()}`}
                className="block rounded-[0.3rem] px-3 py-2 text-sm text-forest-900/80 transition hover:bg-forest-900/5 hover:text-forest-900"
              >
                {r}
                <span className="ml-2 text-xs text-forest-900/40">{byRegion.get(r)?.length ?? 0}</span>
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          {filtered.length === 0 ? (
            <p className="mt-10 text-center text-forest-900/60" data-testid="airports-empty">
              No airports match that search. Try clearing a filter.
            </p>
          ) : (
            orderedRegions.map((r) => (
              <section
                key={r}
                id={`region-${r.replace(/\s+/g, '-').toLowerCase()}`}
                className="mb-16 scroll-mt-24"
              >
                <header className="flex items-baseline justify-between border-b border-forest-900/10 pb-3">
                  <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-3xl">{r}</h2>
                  <span className="text-sm font-light text-forest-900/50">
                    {byRegion.get(r)!.length} airport{byRegion.get(r)!.length === 1 ? '' : 's'}
                  </span>
                </header>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {byRegion.get(r)!.slice(0, 120).map((a) => <AirportCard key={a.id} airport={a} />)}
                </div>
                {byRegion.get(r)!.length > 120 && (
                  <p className="mt-4 text-xs text-forest-900/50">
                    + {byRegion.get(r)!.length - 120} more in {r} — use search to narrow.
                  </p>
                )}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  blurb,
  icon,
}: {
  label: string;
  value: string;
  blurb: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-[0.3rem] border border-forest-900/10 bg-forest-900/[0.02] p-5"
      data-testid={`airports-summary-${label.toLowerCase()}`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-widest text-forest-900/60">{label}</div>
        <div className="mt-2 font-urbanist text-3xl font-bold leading-none text-forest-900">{value}</div>
        <p className="mt-3 text-sm leading-snug text-forest-900/65">{blurb}</p>
      </div>
      <div
        aria-hidden
        className="flex h-12 w-12 flex-none items-center justify-center text-forest-900/55"
      >
        {icon}
      </div>
    </div>
  );
}

function RunwayIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 26 L 24 6 L 28 8 L 22 22 L 38 24 L 42 26 L 24 30 L 18 42 L 14 40 L 18 26 L 6 26 Z" />
      <line x1="14" y1="44" x2="34" y2="44" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="18" />
      <ellipse cx="24" cy="24" rx="9" ry="18" />
      <line x1="6" y1="24" x2="42" y2="24" />
      <path d="M8 14 C 16 18, 32 18, 40 14" />
      <path d="M8 34 C 16 30, 32 30, 40 34" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="18" />
      <polygon points="24,12 28,24 24,36 20,24" fill="currentColor" stroke="none" opacity="0.85" />
      <circle cx="24" cy="24" r="1.5" fill="currentColor" />
    </svg>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider transition ' +
        (active
          ? 'border-forest-900 bg-forest-900 text-sand-100'
          : 'border-forest-900/20 text-forest-900/80 hover:border-forest-900/40 hover:bg-forest-900/5')
      }
    >
      {label}
    </button>
  );
}

function AirportCard({ airport }: { airport: StrapiAirport }) {
  return (
    <Link
      href={airportPath(airport)}
      className="group flex items-center justify-between gap-3 rounded-[0.3rem] border border-forest-900/10 bg-[#f7f8fa] px-4 py-3 transition hover:-translate-y-0.5 hover:border-forest-900/30"
      data-testid={`airport-card-${airport.iata}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex-none rounded-[0.3rem] bg-forest-900 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-sand-100">
            {airport.iata}
          </span>
          <div className="truncate font-urbanist text-sm font-bold text-forest-900 group-hover:text-forest-700">
            {airport.city || airport.name}
          </div>
        </div>
        <div className="mt-1 truncate text-xs text-forest-900/60">
          {airport.name}
          {airport.country && <span className="ml-2 text-forest-900/40">· {airport.country}</span>}
        </div>
      </div>
    </Link>
  );
}

function HubChip({ airport }: { airport: StrapiAirport }) {
  const img = mediaUrl(airport.heroImage ?? null);
  return (
    <Link
      href={airportPath(airport)}
      className="group flex h-full overflow-hidden rounded-lg border border-forest-900/10 bg-[#f7f8fa] transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
      data-testid={`hub-chip-${airport.iata}`}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={airport.name}
          className="h-20 w-24 shrink-0 object-cover transition duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-20 w-24 shrink-0 items-center justify-center bg-forest-900 font-mono text-sm font-bold text-sand-100">
          {airport.iata}
        </div>
      )}
      <div className="flex flex-1 flex-col justify-center p-3">
        <div className="font-urbanist text-sm font-bold leading-tight text-forest-900 transition group-hover:text-forest-700">
          {airport.city || airport.name}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-forest-900/60">
          <span aria-hidden>{flagEmoji(airport.countryCode)}</span>
          <span className="truncate">{airport.country ?? '?'}</span>
        </div>
      </div>
    </Link>
  );
}
