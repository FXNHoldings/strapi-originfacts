'use client';

import { useEffect, useState } from 'react';

/**
 * Enforces the ?airline=XX carrier filter on the TPWL results list — the SDK
 * itself ignores the param, so we watch #tpwl-tickets and hide tickets that
 * don't involve the requested carrier. Carrier detection uses the airline
 * logo images the widget renders (img.avs.io URLs embed the IATA code, e.g.
 * .../al_square/QF@avif), and a ticket stays visible when ANY of its segments
 * match (so codeshares with a matching leg are kept).
 *
 * If a search returns no tickets at all for the airline, everything is
 * un-hidden and a notice explains that all carriers are being shown.
 */
export default function AirlineResultsFilter() {
  const [info, setInfo] = useState<{ code: string; name: string } | null>(null);
  const [noMatches, setNoMatches] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    let code = (sp.get('airline') || '').toUpperCase();
    let name = sp.get('an') || code;
    // Fallback: a search launched from an airline page's search box seeds the
    // carrier in sessionStorage (the TPWL widget can't add ?airline= itself).
    // Honour it for 30 minutes when no explicit ?airline= is present.
    if (!/^[A-Z0-9]{2,3}$/.test(code)) {
      try {
        const seed = JSON.parse(sessionStorage.getItem('oc_airline_filter') || 'null');
        if (seed && typeof seed.code === 'string' && Date.now() - (seed.ts || 0) < 30 * 60 * 1000) {
          code = seed.code.toUpperCase();
          name = seed.name || code;
        }
      } catch {
        /* ignore */
      }
    }
    if (!/^[A-Z0-9]{2,3}$/.test(code)) return;
    setInfo({ code, name });

    const logoMatches = (src: string) => new RegExp(`/${code}(@|\\.|-)`, 'i').test(src);

    // Travelpayouts renders the ticket list inside the OPEN shadow root attached
    // to #tpwl-tickets, so a plain querySelectorAll on the container finds
    // nothing. Walk the light DOM AND every nested shadow root to collect the
    // carrier-logo images (host is img.avs.io, e.g. /al_square/QF@avif).
    const deepLogos = (root: Element | ShadowRoot | Document): HTMLImageElement[] => {
      const out: HTMLImageElement[] = [];
      const stack: (Element | ShadowRoot | Document)[] = [root];
      while (stack.length) {
        const node = stack.pop();
        if (!node || !('querySelectorAll' in node)) continue;
        // The node's OWN shadow root — the ticket list lives in the shadow root
        // attached directly to #tpwl-tickets, and querySelectorAll('*') below
        // only reaches DESCENDANTS' shadow roots, so we'd miss it otherwise.
        const ownShadow = (node as Element).shadowRoot;
        if (ownShadow) stack.push(ownShadow);
        node
          .querySelectorAll<HTMLImageElement>('img[src*="avs.io"]')
          .forEach((img) => out.push(img));
        node.querySelectorAll<HTMLElement>('*').forEach((el) => {
          if (el.shadowRoot) stack.push(el.shadowRoot);
        });
      }
      return out;
    };

    const classStr = (el: Element) =>
      typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';

    // Primary: the TP ticket card is `div.FlightCard-module__card___<hash>`.
    // Its inner parts (cardTop/cardRight/cardBlockFlight…) also contain the
    // substring "card", so we match the exact `card___` token — the hash before
    // it changes per TP build but the component/class name is stable.
    const CARD_RE = /FlightCard-module__card___/;
    const cardByClass = (img: Element): HTMLElement | null => {
      let el: HTMLElement | null = img.parentElement;
      while (el) {
        if (CARD_RE.test(classStr(el))) return el;
        el = el.parentElement;
      }
      return null;
    };

    // Fallback (if TP ever renames the class): climb to the ancestor level with
    // the most logo-bearing siblings — that level is the ticket list, so the
    // element at it is one card.
    const cardByStructure = (img: Element): HTMLElement | null => {
      const hasLogo = (c: Element) => !!c.querySelector?.('img[src*="avs.io"]');
      let el: HTMLElement | null = img.parentElement;
      let best: HTMLElement | null = null;
      let bestCount = 1;
      while (el && el.parentElement) {
        const siblings = Array.from(el.parentElement.children).filter(hasLogo).length;
        if (siblings > bestCount) {
          bestCount = siblings;
          best = el;
        }
        el = el.parentElement;
      }
      return best || (img.parentElement as HTMLElement | null);
    };

    const apply = () => {
      const root = document.getElementById('tpwl-tickets') || document.body;
      const imgs = deepLogos(root);
      if (!imgs.length) return;

      // Use the class-based card resolver when the FlightCard scheme is present
      // (scopes strictly to ticket cards, ignoring any sidebar/matrix logos);
      // otherwise fall back to the structural climb.
      const useClass = imgs.some((img) => cardByClass(img));
      const resolve = useClass ? cardByClass : cardByStructure;

      const cards = new Map<HTMLElement, boolean>();
      imgs.forEach((img) => {
        const card = resolve(img);
        if (!card) return; // logo not inside a ticket card → leave it alone
        cards.set(card, (cards.get(card) ?? false) || logoMatches(img.src));
      });

      let shown = 0;
      cards.forEach((ok) => { if (ok) shown++; });

      if (shown === 0) {
        cards.forEach((_, card) => card.style.removeProperty('display'));
        setNoMatches(true);
        return;
      }
      setNoMatches(false);
      cards.forEach((ok, card) => {
        if (ok) card.style.removeProperty('display');
        else card.style.display = 'none';
      });
    };

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    // Polling backstop — MutationObserver does not see mutations inside shadow
    // roots, so re-run on an interval to catch tickets rendered there.
    const timer = window.setInterval(apply, 700);
    apply();
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  if (!info) return null;

  const clearHref = (() => {
    if (typeof window === 'undefined') return '/flight-search';
    const sp = new URLSearchParams(window.location.search);
    sp.delete('airline');
    sp.delete('an');
    return `/flight-search?${sp.toString()}`;
  })();

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-3 rounded-[0.3rem] border border-primary-emphasis/20 bg-primary-emphasis/5 px-4 py-3 text-sm text-forest-900"
      data-testid="airline-results-filter"
    >
      <span>
        {noMatches ? (
          <>No <strong>{info.name}</strong> flights found for this search — showing all airlines instead.</>
        ) : (
          <>Showing <strong>{info.name}</strong> ({info.code}) flights only.</>
        )}
      </span>
      <a href={clearHref} className="font-semibold text-primary-emphasis underline-offset-2 hover:underline">
        Show all airlines
      </a>
    </div>
  );
}
