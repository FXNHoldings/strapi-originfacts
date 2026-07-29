import type { ReactNode } from 'react';

/**
 * Accessible comparison table for coded pages (best-of lists, route/price
 * comparisons) — real <caption>, <th scope>, and an overflow wrapper so wide
 * tables scroll instead of breaking the layout. Semantic <table> markup is
 * what makes these sections eligible for table featured snippets.
 *
 * Markdown article bodies don't need this component: GFM tables in `content`
 * already render as real <table> markup via marked.
 *
 * Usage:
 *   <ComparisonTable
 *     caption="Cheapest months to fly Perth → London"
 *     head={['Month', 'Typical return fare', 'Notes']}
 *     rows={[
 *       ['May', 'A$1,250', 'Shoulder season'],
 *       ['November', 'A$1,180', 'Cheapest overall'],
 *     ]}
 *   />
 */
export default function ComparisonTable({
  caption,
  head,
  rows,
  firstColIsHeader = true,
}: {
  caption: string;
  head: ReactNode[];
  rows: ReactNode[][];
  /** Mark each row's first cell as a row header (scope="row"). */
  firstColIsHeader?: boolean;
}) {
  if (head.length === 0 || rows.length === 0) return null;

  return (
    <div className="overflow-x-auto" data-testid="comparison-table">
      <table className="w-full border-collapse text-left text-[15px] leading-6 text-forest-950">
        <caption className="pb-3 text-left font-urbanist text-sm font-bold uppercase tracking-widest text-forest-900/70">
          {caption}
        </caption>
        <thead>
          <tr className="border-b-2 border-forest-900/20">
            {head.map((h, i) => (
              <th key={i} scope="col" className="py-2.5 pr-6 font-urbanist text-sm font-bold uppercase tracking-wider text-forest-900">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r} className="border-b border-forest-900/10">
              {cells.map((cell, c) =>
                c === 0 && firstColIsHeader ? (
                  <th key={c} scope="row" className="py-2.5 pr-6 font-semibold">
                    {cell}
                  </th>
                ) : (
                  <td key={c} className="py-2.5 pr-6 font-light">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
