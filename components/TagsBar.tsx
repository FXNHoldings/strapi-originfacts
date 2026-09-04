'use client';

import { useCallback, useRef } from 'react';
import Link from 'next/link';

const TAGS = [
  'Travel',
  'Flights',
  'Hotels',
  'Bangkok',
  'Japan',
  'Singapore',
  'Australia',
  'Beach',
  'Adventure',
  'Budget',
  'Family',
  'Solo',
  'Backpacking',
  'Asia',
  'Europe',
  'USA',
  'Tips',
  'Guides',
  'Photography',
  'Food',
];

const PANEL_BG = '#f1f5f9';

export default function TagsBar() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const stride = Math.max(200, track.clientWidth * 0.6);
    track.scrollTo({ left: track.scrollLeft + stride * direction, behavior: 'smooth' });
  }, []);

  return (
    <section className="mt-[50px] py-8" data-testid="home-tags-bar">
      <div className="mx-auto max-w-7xl px-6">
        <div
          className="relative h-10 overflow-hidden rounded-[5px] shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
          style={{ backgroundColor: PANEL_BG }}
        >
          <div
            ref={trackRef}
            className="flex h-full items-center overflow-x-auto scroll-smooth pr-[72px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {TAGS.map((tag, i) => (
              <div key={tag} className="relative flex shrink-0 items-center">
                <Link
                  href={`/all-articles?q=${encodeURIComponent(tag)}`}
                  className="font-urbanist whitespace-nowrap pl-5 pr-[37px] text-[14px] font-medium leading-10 text-[#080808] transition hover:text-primary-emphasis"
                >
                  #{tag}
                </Link>
                {i < TAGS.length - 1 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-[18px] top-1/2 h-4 w-px -translate-y-1/2 bg-[#080808]/15"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Nav panel — gradient fade + arrow buttons, anchored right */}
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 flex w-[92px] items-center justify-end pr-2"
            aria-hidden
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-5"
              style={{
                background: `linear-gradient(90deg, rgba(241,245,249,0) 0%, ${PANEL_BG} 100%)`,
              }}
            />
            <div
              className="absolute left-5 top-0 bottom-0 right-0"
              style={{ backgroundColor: PANEL_BG }}
            />
          </div>
          <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Scroll tags left"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#080808] transition hover:bg-white/60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Scroll tags right"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#080808] transition hover:bg-white/60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
