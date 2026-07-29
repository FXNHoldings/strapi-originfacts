'use client';

import { useEffect, useRef, useState } from 'react';
import FareCalendar from '@/components/FareCalendar';

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
}: {
  placeholder: string;
  value: Place | null;
  onSelect: (p: Place | null) => void;
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
    <div className="relative min-w-[130px] flex-1" ref={boxRef}>
      {value ? (
        <div className="flex h-full items-center px-3 py-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-forest-900/[0.06] py-1 pl-2.5 pr-1.5 text-sm font-semibold text-forest-900">
            {value.label} ({value.code})
            <button
              type="button"
              aria-label="Clear"
              onClick={() => {
                onSelect(null);
                setOpen(true);
              }}
              className="grid h-4 w-4 place-items-center rounded-full text-forest-900/50 hover:bg-forest-900/10 hover:text-forest-900"
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
          className="h-full w-full rounded-md bg-transparent px-3 py-2.5 text-sm text-forest-900 placeholder:text-forest-900/45 focus:outline-none focus:ring-2 focus:ring-forest-900/70"
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

export default function CustomFlightSearch({
  airlineIata,
  airlineName,
}: {
  airlineIata?: string | null;
  airlineName?: string;
}) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [depart, setDepart] = useState('');
  const [ret, setRet] = useState('');
  const [pax, setPax] = useState(1);
  const [oneWay, setOneWay] = useState(false);
  const [directOnly, setDirectOnly] = useState(false);
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

  return (
    <form onSubmit={submit} data-testid="custom-flight-search" className="w-full">
      {/* Trip type */}
      <div className="mb-2">
        <select
          value={oneWay ? 'oneway' : 'return'}
          onChange={(e) => setOneWay(e.target.value === 'oneway')}
          className="rounded-md bg-transparent py-1 pl-1 pr-6 text-sm font-semibold text-forest-900 focus:outline-none"
        >
          <option value="return">Return</option>
          <option value="oneway">One way</option>
        </select>
      </div>

      {/* Main bar */}
      <div className="flex flex-wrap items-stretch gap-1 rounded-lg border border-forest-900/15 bg-white p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <PlaceSegment placeholder="From?" value={origin} onSelect={setOrigin} />

        <button
          type="button"
          onClick={swap}
          aria-label="Swap origin and destination"
          className="my-1 grid w-9 flex-none place-items-center rounded-md text-forest-900/60 hover:bg-forest-50 hover:text-forest-900"
        >
          ⇄
        </button>

        <PlaceSegment placeholder="To?" value={destination} onSelect={setDestination} />

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
        <div className={`${seg} min-w-[110px] flex-none`}>
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
          className="my-0.5 flex-none rounded-md px-6 text-sm font-bold text-white transition hover:brightness-95"
          style={{ backgroundColor: KAYAK_ORANGE }}
        >
          Search
        </button>
      </div>

      {/* Direct flights only */}
      <div className="mt-2 flex items-center justify-end gap-2 text-sm text-forest-900/70">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={directOnly}
            onChange={(e) => setDirectOnly(e.target.checked)}
            className="h-4 w-4 accent-primary-emphasis"
          />
          Direct flights only
        </label>
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </form>
  );
}
