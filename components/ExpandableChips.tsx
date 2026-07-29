'use client';

import { useState } from 'react';

/**
 * A wrapping list of chips that shows the first `initial` items and reveals the
 * rest via a working "+N more" toggle button (collapses again with "Show less").
 * Used for destination and fleet lists in the Route Network section.
 */
export default function ExpandableChips({
  items,
  initial = 24,
  testId,
}: {
  items: string[];
  initial?: number;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const hidden = items.length - initial;
  const shown = open ? items : items.slice(0, initial);

  return (
    <div className="mt-4 flex flex-wrap gap-2" data-testid={testId}>
      {shown.map((c) => (
        <span
          key={c}
          className="rounded-md border border-forest-900/12 bg-white/80 px-2.5 py-1 text-[13px] font-semibold text-forest-900/85"
        >
          {c}
        </span>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="rounded-md border border-dashed border-forest-900/30 px-2.5 py-1 text-[13px] font-semibold text-forest-900/60 transition hover:border-primary-emphasis hover:text-primary-emphasis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-emphasis"
        >
          {open ? 'Show less' : `+${hidden} more`}
        </button>
      )}
    </div>
  );
}
