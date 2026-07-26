'use client';

import { useEffect } from 'react';

const TPWL_SRC = 'https://tpscr.com/wl_web/main.js?wl_id=16677';

/**
 * Loads the Travelpayouts white-label SDK on the flight-search page.
 *
 * The SDK scans for its #tpwl-search / #tpwl-tickets containers exactly once,
 * when main.js executes. It used to be loaded globally from app/layout.tsx,
 * which broke client-side navigation: arriving at the page via a <Link> meant
 * the SDK had already run before the containers existed, so the search form
 * only appeared after a hard refresh.
 *
 * Mounting the loader on the page itself — with a unique query param per mount
 * so the browser's module map doesn't skip re-execution — makes the SDK rescan
 * on every visit. Its sub-chunks stay cached; only the small entry module
 * re-runs.
 */
export default function TpwlLoader() {
  useEffect(() => {
    // Drop any loader tag from a previous visit before injecting a fresh one.
    document
      .querySelectorAll('script[data-tpwl-loader]')
      .forEach((el) => el.remove());

    const script = document.createElement('script');
    script.async = true;
    script.type = 'module';
    script.src = `${TPWL_SRC}&mount=${Date.now()}`;
    script.setAttribute('data-tpwl-loader', '');
    document.head.appendChild(script);
  }, []);

  return null;
}
