'use client';

import { useEffect, useRef, useState } from 'react';

const COLLAPSED_HEIGHT = 600; // px

/**
 * Renders the airline "About" prose. When the content is taller than
 * COLLAPSED_HEIGHT it is clamped to that height (with a soft fade) and a
 * "View more" text link reveals the rest.
 */
export default function AboutParagraphs({ paragraphs }: { paragraphs: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  // Seed from paragraph count so the clamp + link render in SSR (long About
  // text is ~4+ paragraphs); the effect refines it against the real height.
  const [overflows, setOverflows] = useState(paragraphs.length >= 4);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight is the full content height regardless of the maxHeight clamp.
    const check = () => setOverflows(el.scrollHeight > COLLAPSED_HEIGHT + 8);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [paragraphs]);

  const clamped = overflows && !expanded;

  return (
    <div data-testid="airline-about-prose">
      <div
        ref={ref}
        className={`prose-article relative overflow-hidden transition-[max-height] duration-300`}
        style={{ maxHeight: clamped ? COLLAPSED_HEIGHT : ref.current?.scrollHeight ?? 'none' }}
      >
        {paragraphs.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
        {clamped && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/95 to-transparent"
          />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-semibold text-forest-700 underline-offset-2 hover:underline"
          data-testid="about-view-more"
        >
          {expanded ? 'View less' : 'View more'}
        </button>
      )}
    </div>
  );
}
