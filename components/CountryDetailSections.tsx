'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { mediaUrl, type StrapiAirport, type StrapiAirline } from '@/lib/strapi';
import { airportPath } from '@/lib/airport-slugs';

const AIRPORTS_PAGE_SIZE = 12;
const AIRLINES_PAGE_SIZE = 12;

export default function CountryDetailSections({
  countryName,
  airports,
  airlines,
}: {
  countryName: string;
  airports: StrapiAirport[];
  airlines: StrapiAirline[];
}) {
  const [airportQuery, setAirportQuery] = useState('');
  const [airlineQuery, setAirlineQuery] = useState('');

  const filteredAirports = useMemo(() => {
    const q = airportQuery.trim().toLowerCase();
    if (!q) return airports;
    return airports.filter((a) =>
      [a.iata, a.icao, a.name, a.city].some((v) => v && v.toLowerCase().includes(q)),
    );
  }, [airports, airportQuery]);

  const filteredAirlines = useMemo(() => {
    const q = airlineQuery.trim().toLowerCase();
    if (!q) return airlines;
    return airlines.filter((al) =>
      [al.name, al.iataCode, al.icaoCode, al.city, al.type, al.legalName].some(
        (v) => v && v.toLowerCase().includes(q),
      ),
    );
  }, [airlines, airlineQuery]);

  return (
    <>
      {/* Airports */}
      <section className="mx-auto mt-16 max-w-7xl px-6" data-testid="country-airports">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-forest-900/10 pb-3">
          <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-2xl">
            Airports in {countryName}
          </h2>
          <span className="text-sm font-light text-forest-900/50">
            {airportQuery.trim()
              ? `${filteredAirports.length} of ${airports.length}`
              : `${airports.length} airport${airports.length === 1 ? '' : 's'}`}
          </span>
        </header>

        {airports.length > 0 && (
          <SearchBox
            value={airportQuery}
            onChange={setAirportQuery}
            placeholder="Filter by IATA, city or name…"
            data-testid="country-airports-search"
          />
        )}

        {airports.length === 0 ? (
          <p className="mt-10 text-forest-900/60">No airports indexed for {countryName} yet.</p>
        ) : filteredAirports.length === 0 ? (
          <p className="mt-10 text-forest-900/60">
            No airports match “{airportQuery}”.
          </p>
        ) : (
          <div className="mt-6 divide-y divide-forest-900/10 border-y border-forest-900/10">
            {filteredAirports.slice(0, AIRPORTS_PAGE_SIZE).map((a) => (
              <AirportCard key={a.id} airport={a} />
            ))}
          </div>
        )}
        {filteredAirports.length > AIRPORTS_PAGE_SIZE && (
          <div className="mt-6">
            <Link
              href={`/airports?country=${encodeURIComponent(countryName)}`}
              className="text-sm font-medium text-forest-700 hover:underline"
              data-testid="country-airports-view-all"
            >
              View all airports →
            </Link>
          </div>
        )}
      </section>

      {/* Airlines */}
      <section className="mx-auto mt-16 max-w-7xl px-6" data-testid="country-airlines">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-forest-900/10 pb-3">
          <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-2xl">
            Airlines based in {countryName}
          </h2>
          <span className="text-sm font-light text-forest-900/50">
            {airlineQuery.trim()
              ? `${filteredAirlines.length} of ${airlines.length}`
              : `${airlines.length} airline${airlines.length === 1 ? '' : 's'}`}
          </span>
        </header>

        {airlines.length > 0 && (
          <SearchBox
            value={airlineQuery}
            onChange={setAirlineQuery}
            placeholder="Filter by name, IATA or city…"
            data-testid="country-airlines-search"
          />
        )}

        {airlines.length === 0 ? (
          <p className="mt-10 text-forest-900/60">No airlines tagged to {countryName} yet.</p>
        ) : filteredAirlines.length === 0 ? (
          <p className="mt-10 text-forest-900/60">
            No airlines match “{airlineQuery}”.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredAirlines.slice(0, AIRLINES_PAGE_SIZE).map((al) => {
              const logo = mediaUrl(al.logo ?? null);
              return (
                <Link
                  key={al.id}
                  href={`/airlines/${al.slug}`}
                  className="group flex min-h-[190px] flex-col rounded-lg border border-forest-900/10 bg-paper p-4 transition hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
                >
                  <div className="flex h-24 w-full flex-none items-center justify-center overflow-hidden rounded-lg bg-white">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt={al.name} className="h-full w-full object-contain p-3" />
                    ) : (
                      <span className="font-urbanist text-sm font-bold text-forest-900/60">
                        {(al.iataCode || al.name).slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="line-clamp-2 font-urbanist text-base font-bold leading-snug text-forest-900 group-hover:text-forest-700">
                        {al.name}
                      </div>
                      {al.iataCode && (
                        <span className="flex-none rounded bg-forest-900 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-sand-100">
                          {al.iataCode}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs text-forest-900/60">
                      {[al.city, al.type].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {filteredAirlines.length > AIRLINES_PAGE_SIZE && (
          <div className="mt-6">
            <Link
              href={`/airlines?country=${encodeURIComponent(countryName)}`}
              className="text-sm font-medium text-forest-700 hover:underline"
              data-testid="country-airlines-view-all"
            >
              View all airlines →
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
  'data-testid': testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  'data-testid'?: string;
}) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-md border border-forest-900/15 bg-paper px-3 py-2 focus-within:border-forest-900/40">
      <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-forest-900/50" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="w-full bg-transparent text-sm text-forest-900 placeholder:text-forest-900/40 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear filter"
          className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-forest-900/50 transition hover:bg-forest-900/10 hover:text-forest-900"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

function AirportCard({ airport }: { airport: StrapiAirport }) {
  return (
    <Link
      href={airportPath(airport)}
      className="group grid gap-3 py-4 transition hover:bg-forest-900/[0.025] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <h3 className="truncate font-urbanist text-base font-bold leading-snug text-forest-900 group-hover:text-forest-700">
          {airport.name}
        </h3>
        <p className="mt-1 truncate text-xs text-forest-900/55">
          {[airport.city, airport.icao].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="font-mono font-bold tracking-wider text-forest-900">{airport.iata}</span>
        <span className="text-forest-900/30" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}
