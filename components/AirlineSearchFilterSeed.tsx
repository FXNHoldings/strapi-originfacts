'use client';

import { useEffect } from 'react';

/**
 * Seeds the airline carrier (IATA code + name) into sessionStorage so that when
 * the embedded flight-search widget navigates to /flight-search, the
 * AirlineResultsFilter there can restrict results to this carrier — the TPWL
 * widget can't add ?airline= to its own submit URL. Session-scoped, 30-min TTL
 * (enforced by the reader).
 */
export default function AirlineSearchFilterSeed({ code, name }: { code: string; name: string }) {
  useEffect(() => {
    if (!/^[A-Za-z0-9]{2,3}$/.test(code)) return;
    try {
      sessionStorage.setItem(
        'oc_airline_filter',
        JSON.stringify({ code: code.toUpperCase(), name, ts: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }, [code, name]);

  return null;
}
