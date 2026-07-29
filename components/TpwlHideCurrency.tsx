'use client';

import { useEffect } from 'react';

/**
 * Hides the currency selector inside the Travelpayouts search widget. The
 * widget renders in a (possibly nested) Shadow DOM, so external CSS can't reach
 * it — we inject a hiding stylesheet into every shadow root under the search
 * container. Selectors are broad (class/aria/data containing "currency") so it
 * catches the control regardless of the widget's exact markup.
 */
const HIDE_CSS = `
  .localization-button-currencies,
  [class*="currency" i],
  [data-currency],
  [data-test*="currency" i],
  [aria-label*="currency" i],
  [title*="currency" i] { display: none !important; }

  /* Search input/field background */
  input,
  textarea,
  [contenteditable="true"],
  [class*="input" i],
  [class*="field" i] { background-color: #f8f8f8 !important; }
`;

export default function TpwlHideCurrency({ containerId = 'tpwl-search' }: { containerId?: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const seen = new WeakSet<ShadowRoot>();

    const injectInto = (root: ShadowRoot) => {
      if (!seen.has(root)) {
        const style = document.createElement('style');
        style.setAttribute('data-hide-currency', '');
        style.textContent = HIDE_CSS;
        root.appendChild(style);
        seen.add(root);
      }
      root.querySelectorAll<HTMLElement>('*').forEach((el) => {
        if (el.shadowRoot) injectInto(el.shadowRoot);
      });
    };

    const inject = () => {
      container.querySelectorAll<HTMLElement>('*').forEach((el) => {
        if (el.shadowRoot) injectInto(el.shadowRoot);
      });
    };

    inject();
    const observer = new MutationObserver(inject);
    observer.observe(container, { childList: true, subtree: true });
    // Shadow-root mutations aren't observed above; poll as a backstop.
    const timer = window.setInterval(inject, 700);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [containerId]);

  return null;
}
