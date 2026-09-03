'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mediaUrl, type StrapiAirline } from '@/lib/strapi';

export type Tier1GuideSlide = {
  airline: StrapiAirline;
  verifiedFields: number;
  destinations: number;
  homeCountry: string;
};

export default function Tier1AirlineCarousel({ slides }: { slides: Tier1GuideSlide[] }) {
  const [startIndex, setStartIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const totalSlides = slides.length;
  // Display 4 cards per row on desktop
  const CARDS_PER_PAGE = 4;

  const nextSlide = useCallback(() => {
    if (totalSlides === 0) return;
    setStartIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    if (totalSlides === 0) return;
    setStartIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Auto slide interval (4 seconds)
  useEffect(() => {
    if (isPaused || totalSlides <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 4000);
    return () => clearInterval(timer);
  }, [isPaused, nextSlide, totalSlides]);

  if (totalSlides === 0) return null;

  // Build visible 4 cards array (wrapping around)
  const visibleCards: Tier1GuideSlide[] = [];
  for (let i = 0; i < Math.min(CARDS_PER_PAGE, totalSlides); i++) {
    const idx = (startIndex + i) % totalSlides;
    visibleCards.push(slides[idx]);
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) nextSlide();
      else prevSlide();
    }
    touchStartX.current = null;
  };

  return (
    <section
      className="relative mt-8 text-forest-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Tier 1 Featured Airlines Carousel"
      data-testid="tier1-airline-carousel"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-forest-900/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800">
              <svg className="h-3 w-3 fill-current" viewBox="0 0 16 16"><path d="m3.5 8.2 2.8 2.7 6.2-6" /></svg>
              Verified Guides
            </span>
            <span className="text-xs font-medium text-forest-900/50">Auto-sliding · Featured policy guides</span>
          </div>
          <h2 className="editorial-h mt-1 text-2xl font-bold text-forest-900">
            Featured Traveller Policy Guides
          </h2>
        </div>

        {/* Carousel controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={prevSlide}
            aria-label="Previous slide"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-forest-900/15 bg-white text-forest-900 shadow-sm transition hover:bg-forest-50 hover:border-forest-900/30 focus:outline-none"
          >
            ←
          </button>
          <span className="font-mono text-xs font-bold text-forest-900/70">
            {String(startIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
          </span>
          <button
            onClick={nextSlide}
            aria-label="Next slide"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-forest-900/15 bg-white text-forest-900 shadow-sm transition hover:bg-forest-50 hover:border-forest-900/30 focus:outline-none"
          >
            →
          </button>
        </div>
      </div>

      {/* 4 Cards Grid Row */}
      <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {visibleCards.map((slide) => {
          const logo = mediaUrl(slide.airline.logo ?? null);
          return (
            <article
              key={slide.airline.slug}
              className="group relative flex flex-col justify-between rounded-lg border border-forest-900/10 bg-[#f7f8fa] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-forest-900/30 hover:shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex h-20 w-36 flex-none items-center justify-start overflow-hidden bg-transparent p-0">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt={slide.airline.name} className="h-full w-full object-contain object-left scale-105" />
                    ) : (
                      <span className="font-urbanist text-lg font-bold text-forest-900/60">
                        {(slide.airline.iataCode || slide.airline.name).slice(0, 3)}
                      </span>
                    )}
                  </div>
                  {slide.airline.iataCode && (
                    <span className="rounded bg-forest-900 px-2 py-0.5 font-mono text-[10px] font-bold text-sand-100">
                      {slide.airline.iataCode}
                    </span>
                  )}
                </div>

                <h3 className="mt-3 truncate font-urbanist text-lg font-bold text-forest-900 group-hover:text-forest-700">
                  {slide.airline.name}
                </h3>
                <p className="mt-0.5 truncate text-xs text-forest-900/60">
                  {[slide.homeCountry, slide.airline.type].filter(Boolean).join(' · ')}
                </p>

                <div className="mt-4 space-y-1 border-t border-forest-900/10 pt-3 text-[11px] text-forest-900/70 font-mono">
                  <div className="flex items-center justify-between">
                    <span>Verified fields:</span>
                    <strong className="text-forest-900">{slide.verifiedFields}</strong>
                  </div>
                  {slide.destinations > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Destinations:</span>
                      <strong className="text-forest-900">{slide.destinations}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <Link
                  href={`/airlines/${slide.airline.slug}`}
                  className="flex w-full items-center justify-center gap-1 rounded-md bg-forest-900 px-3 py-2 text-center text-xs font-bold text-sand-100 transition hover:bg-forest-800"
                >
                  Open Guide ↗
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {/* Slide Navigation Indicator Dots */}
      <div className="mt-6 flex items-center justify-center gap-1.5">
        {slides.map((slide, idx) => (
          <button
            key={slide.airline.slug}
            onClick={() => setStartIndex(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              idx === startIndex ? 'w-6 bg-forest-900' : 'w-1.5 bg-forest-900/20 hover:bg-forest-900/40'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
