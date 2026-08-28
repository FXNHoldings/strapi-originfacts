'use client';

import { useEffect, useRef, useState } from 'react';
import FareCalendar from '@/components/FareCalendar';
import TravelpayoutsCarSearch from '@/components/TravelpayoutsCarSearch';

/**
 * Kayak-style flight-search bar (Option A). Fully custom UI — no Travelpayouts
 * widget. On submit it deep-links to /flight-search with origin/destination/
 * dates/pax + this page's airline code, which the existing pass-through turns
 * into the TP deep-link and filters results to that carrier. Same results +
 * commission as the widget, full control of the form.
 *
 * Airport/city lookup uses Travelpayouts' public places autocomplete
 * (no token, CORS-enabled — the same source the widget uses).
 */

type Place = { code: string; label: string; sub: string };

const AUTOCOMPLETE =
  'https://autocomplete.travelpayouts.com/places2?locale=en&types[]=city&types[]=airport&term=';

const KAYAK_ORANGE = '#ff690f';

function useAutocomplete(query: string, enabled: boolean) {
  const [results, setResults] = useState<Place[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(AUTOCOMPLETE + encodeURIComponent(q));
        const data: Array<Record<string, string>> = await res.json();
        setResults(
          (data || []).slice(0, 8).map((d) => ({
            code: d.code,
            label: d.city_name && d.city_name !== d.name ? `${d.name}, ${d.city_name}` : d.name,
            sub: d.country_name || '',
          })),
        );
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, enabled]);
  return results;
}

/** One origin/destination segment: a chip when chosen, an autocomplete input otherwise. */
function PlaceSegment({
  placeholder,
  value,
  onSelect,
  hero = false,
}: {
  placeholder: string;
  value: Place | null;
  onSelect: (p: Place | null) => void;
  hero?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const results = useAutocomplete(query, open && !value);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (p: Place) => {
    onSelect(p);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className={`relative min-w-[150px] flex-1 ${hero ? 'lg:min-w-[210px]' : ''}`} ref={boxRef}>
      {value ? (
        <div className="flex h-full items-center px-3 py-2">
          {hero && <PlaneIcon className="mr-2 size-5 flex-none text-forest-900" />}
          <span className={hero ? 'min-w-0 truncate text-[15px] font-semibold text-forest-900' : 'inline-flex items-center gap-1.5 rounded-md bg-forest-900/[0.06] py-1 pl-2.5 pr-1.5 text-sm font-semibold text-forest-900'}>
            {value.code} <span className="font-normal">- {value.label}</span>
            <button
              type="button"
              aria-label="Clear"
              onClick={() => {
                onSelect(null);
                setOpen(true);
              }}
              className={`${hero ? 'ml-1 inline-grid' : 'grid'} h-4 w-4 place-items-center rounded-full text-forest-900/50 hover:bg-forest-900/10 hover:text-forest-900`}
            >
              ✕
            </button>
          </span>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={`h-full w-full bg-transparent px-3 py-2.5 text-sm text-forest-900 placeholder:text-forest-900/45 focus:outline-none ${hero ? 'rounded-none focus:bg-blue-50/40' : 'rounded-md focus:ring-2 focus:ring-forest-900/70'}`}
        />
      )}
      {open && !value && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-[260px] max-w-[80vw] overflow-auto rounded-lg border border-forest-900/15 bg-white py-1 shadow-xl">
          {results.map((p) => (
            <li key={`${p.code}-${p.label}`}>
              <button
                type="button"
                onClick={() => choose(p)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-forest-50"
              >
                <span className="min-w-0 truncate text-forest-900">
                  {p.label}
                  {p.sub && <span className="text-forest-900/50"> · {p.sub}</span>}
                </span>
                <span className="flex-none font-mono text-xs font-bold text-forest-900/55">{p.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const Divider = () => <span className="my-2 hidden w-px self-stretch bg-forest-900/10 sm:block" />;

function PlaneIcon({ className = 'size-5' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden><path d="m3 11 18-7-7 17-3-7-8-3Z" strokeLinejoin="round"/><path d="m11 14 4-4" strokeLinecap="round"/></svg>;
}

function ProductIcon({ kind }: { kind: 'flight' | 'hotel' | 'car' | 'package' }) {
  if (kind === 'flight') return <PlaneIcon className="size-5" />;
  if (kind === 'hotel') return <span aria-hidden className="text-lg">▤</span>;
  if (kind === 'car') return <span aria-hidden className="text-lg">▱</span>;
  return <span aria-hidden className="text-lg">☂</span>;
}

export default function CustomFlightSearch({
  airlineIata,
  airlineName,
  variant = 'compact',
}: {
  airlineIata?: string | null;
  airlineName?: string;
  variant?: 'compact' | 'hero';
}) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [depart, setDepart] = useState('');
  const [ret, setRet] = useState('');
  const [pax, setPax] = useState(1);
  const [oneWay, setOneWay] = useState(false);
  const [directOnly, setDirectOnly] = useState(false);
  const [addHotel, setAddHotel] = useState(false);
  const [addCar, setAddCar] = useState(false);
  const [cabin, setCabin] = useState('Economy');
  const [activeProduct, setActiveProduct] = useState<'flight' | 'car'>('flight');
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  // Prefill (client-side, after mount to avoid SSR/hydration mismatch):
  //  - default dates within the next 4 weeks (depart +14d, return +21d)
  //  - "From" = visitor's nearest city, detected by IP via /api/nearest-city
  useEffect(() => {
    const iso = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    setDepart((prev) => prev || iso(14));
    setRet((prev) => prev || iso(21));

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/nearest-city');
        const j = (await res.json()) as { code?: string; name?: string; country?: string };
        if (!cancelled && j?.code && j?.name) {
          setOrigin((prev) => prev ?? { code: j.code!, label: j.name!, sub: j.country || '' });
        }
      } catch {
        /* no prefill */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin?.code || !destination?.code) return setError('Choose a departure and destination.');
    if (!depart) return setError('Pick a departure date.');
    if (!oneWay && !ret) return setError('Pick a return date, or switch to One way.');
    setError('');
    const params = new URLSearchParams({
      origin: origin.code,
      destination: destination.code,
      depart,
      pax: String(pax),
    });
    if (!oneWay && ret) params.set('return', ret);
    if (directOnly) params.set('direct', 'true');
    if (airlineIata) params.set('airline', airlineIata);
    if (airlineName) params.set('an', airlineName);
    window.location.href = `/flight-search?${params.toString()}`;
  };

  const seg = 'flex items-center px-3 text-sm text-forest-900';
  const hero = variant === 'hero';

  const productNav = hero ? (
    <nav aria-label="Travel products" className="mb-10 flex flex-wrap gap-3">
      {([
        ['Flights', 'flight'], ['Packages', 'package'], ['Hotels', 'hotel'], ['Cars', 'car'],
      ] as const).map(([label, kind]) => {
        const selected = activeProduct === kind;
        const available = kind === 'flight' || kind === 'car';
        return (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (kind === 'flight' || kind === 'car') setActiveProduct(kind);
            }}
            aria-pressed={selected}
            aria-disabled={!available}
            title={available ? `Search ${label.toLowerCase()}` : `${label} search coming soon`}
            className={`inline-flex min-w-[128px] items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-[0_8px_18px_rgba(5,33,78,0.10)] transition ${selected ? 'bg-primary-emphasis text-white' : 'bg-white text-forest-900 hover:bg-blue-50'} ${available ? '' : 'cursor-not-allowed opacity-55'}`}
          >
            <ProductIcon kind={kind} /> {label}
          </button>
        );
      })}
    </nav>
  ) : null;

  if (hero && activeProduct === 'car') {
    return (
      <div data-testid="custom-travel-search" className="w-full">
        {productNav}
        <TravelpayoutsCarSearch />
      </div>
    );
  }

  return (
    <div data-testid="custom-travel-search" className="w-full">
      {productNav}
      <form onSubmit={submit} data-testid="custom-flight-search" className="w-full">
      <div className={`flex flex-wrap items-center gap-x-7 gap-y-2 ${hero ? 'mb-4' : 'mb-2'}`}>
        <select
          value={oneWay ? 'oneway' : 'return'}
          onChange={(e) => setOneWay(e.target.value === 'oneway')}
          className="rounded-md bg-transparent py-1 pl-1 pr-6 text-sm font-semibold text-forest-900 focus:outline-none"
        >
          <option value="return">Return</option>
          <option value="oneway">One way</option>
        </select>
        {hero && (
          <>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-forest-900">
              <span aria-hidden>♙</span>
              <select value={pax} onChange={(e) => setPax(Number(e.target.value))} className="bg-transparent py-1 focus:outline-none" aria-label="Travelers">
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} Traveler{n === 1 ? '' : 's'}</option>)}
              </select>
            </label>
            <select value={cabin} onChange={(e) => setCabin(e.target.value)} className="bg-transparent py-1 text-sm font-semibold text-forest-900 focus:outline-none" aria-label="Cabin class">
              <option>Economy</option><option>Premium economy</option><option>Business</option><option>First</option>
            </select>
          </>
        )}
      </div>

      {/* Main bar */}
      <div className={`flex flex-wrap items-stretch bg-white ${hero ? 'gap-0 rounded-full border border-[#b8c9e2] p-2 shadow-[0_12px_28px_rgba(11,42,91,0.12)]' : 'gap-1 rounded-lg border border-forest-900/15 p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
        <PlaceSegment placeholder="Where from?" value={origin} onSelect={setOrigin} hero={hero} />

        <button
          type="button"
          onClick={swap}
          aria-label="Swap origin and destination"
          className={`${hero ? 'my-0 h-11 w-11 rounded-full border border-[#c8d5e7] bg-white shadow-sm' : 'my-1 w-9 rounded-md'} grid flex-none place-items-center text-forest-900/60 hover:bg-forest-50 hover:text-forest-900`}
        >
          ⇄
        </button>

        <PlaceSegment placeholder="Where to?" value={destination} onSelect={setDestination} hero={hero} />

        <Divider />

        {/* Dates — custom two-month fare calendar (dd/mm/yyyy, colour-coded) */}
        <FareCalendar
          depart={depart}
          ret={ret}
          oneWay={oneWay}
          minDate={today}
          origin={origin?.code}
          destination={destination?.code}
          onChange={(d, r) => {
            setDepart(d);
            setRet(r);
          }}
        />

        <Divider />

        {/* Passengers */}
        <div className={`${seg} min-w-[110px] flex-none ${hero ? 'hidden' : ''}`}>
          <select
            value={pax}
            onChange={(e) => setPax(Number(e.target.value))}
            aria-label="Passengers"
            className="bg-transparent py-2 text-sm text-forest-900 focus:outline-none"
          >
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} adult{n === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <button
          type="submit"
          className={`${hero ? 'm-0 min-h-12 rounded-full px-12 text-base' : 'my-0.5 rounded-md px-6 text-sm'} flex-none font-bold text-white transition hover:brightness-95`}
          style={{ backgroundColor: hero ? '#ff4b0a' : KAYAK_ORANGE }}
        >
          Search
        </button>
      </div>

      {/* Direct flights only */}
      <div className={`mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-forest-900/70 ${hero ? 'justify-between px-4' : 'justify-end'}`}>
        {hero && <div className="flex flex-wrap items-center gap-5"><strong className="text-xs text-forest-900">Bundle &amp; Save</strong><label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={addHotel} onChange={(e) => setAddHotel(e.target.checked)} className="size-5 rounded border-[#9fb4d2] accent-primary-emphasis" /> Add Hotel</label><label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={addCar} onChange={(e) => setAddCar(e.target.checked)} className="size-5 rounded border-[#9fb4d2] accent-primary-emphasis" /> Add Car</label></div>}
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={directOnly}
            onChange={(e) => setDirectOnly(e.target.checked)}
            className="h-4 w-4 accent-primary-emphasis"
          />
          {hero ? 'Direct flights only' : 'Direct flights only'}
        </label>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      </form>
    </div>
  );
}
