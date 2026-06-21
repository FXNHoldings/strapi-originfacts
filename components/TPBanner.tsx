'use client';

import { useEffect, useRef } from 'react';

type Props = {
  /** Full Travelpayouts tpscr.com URL — the embed string TP gives you. */
  src: string;
  /** Optional CSS for the container box. Defaults to inline-block. */
  className?: string;
  /** Test id for the wrapper. */
  testId?: string;
};

/**
 * Inline TravelPayouts banner. TP banner scripts render at the position of
 * their <script> tag in the DOM, so we append the script into a ref'd
 * container on mount (the standard pattern used by PriceCalendar +
 * ScheduleWidget). Cleared on unmount so route changes re-init cleanly.
 */
export default function TPBanner({ src, className = 'block', testId = 'tp-banner' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = '';
    const script = document.createElement('script');
    script.async = true;
    script.charset = 'utf-8';
    script.src = src;
    container.appendChild(script);
    return () => { container.innerHTML = ''; };
  }, [src]);

  return <div ref={containerRef} className={className} data-testid={testId} />;
}
