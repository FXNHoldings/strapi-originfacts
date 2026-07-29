import { getAirlineReviews, SUBRATING_LABELS } from '@/lib/airline-reviews';

/**
 * Traveller reviews from the unified review store. Currently fed by the
 * Skytrax archive dataset (reviews up to mid-2015), so the section is
 * explicitly framed as historical and every card carries its date.
 * Attribution: reviews originally published on airlinequality.com (Skytrax).
 */
export default function AirlineReviews({ slug, name }: { slug: string; name: string }) {
  const data = getAirlineReviews(slug);
  if (!data || data.stats.reviewCount === 0) return null;

  const { stats } = data;
  const shown = data.reviews.slice(0, 6);
  const years = `${stats.firstReviewDate.slice(0, 4)}–${stats.lastReviewDate.slice(0, 4)}`;
  const subs = stats.subratings
    ? Object.entries(stats.subratings).map(([k, v]) => ({ label: SUBRATING_LABELS[k] ?? k, avg: v }))
    : [];

  return (
    <section className="mx-auto max-w-6xl px-6 pb-20" data-testid="airline-reviews">
      <header className="flex flex-col gap-3 border-b border-forest-900/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow-tag">
            <span className="inline-block h-px w-8 bg-forest-800/60" />
            Traveller reviews
          </p>
          <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">
            What travellers said about {name}
          </h2>
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-forest-900/50">
          Skytrax archive · {years}
        </span>
      </header>

      {/* Summary tiles + category averages */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="rounded-[0.3rem] border border-forest-900/10 bg-white/85 p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          {stats.avgRating10 !== null && (
            <div className="font-urbanist text-5xl font-bold text-forest-900">
              {stats.avgRating10.toFixed(1)}
              <span className="text-xl font-semibold text-forest-900/45">/10</span>
            </div>
          )}
          <div className="mt-2 text-xs text-forest-900/60">
            {stats.reviewCount.toLocaleString()} traveller review{stats.reviewCount === 1 ? '' : 's'}
          </div>
          {stats.recommendPct !== null && (
            <div className="mt-3 rounded-[0.3rem] bg-forest-900/[0.04] px-3 py-2 text-xs text-forest-900/75">
              <span className="font-bold text-forest-900">{stats.recommendPct}%</span> recommended the airline
            </div>
          )}
        </div>

        {subs.length > 0 && (
          <div className="rounded-[0.3rem] border border-forest-900/10 bg-white/85 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-forest-900/50">
              Category averages (out of 5)
            </h3>
            <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {subs.map((s) => (
                <li key={s.label} className="flex items-center gap-3 text-xs text-forest-900/70">
                  <span className="w-36 flex-none">{s.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-forest-900/10">
                    <span
                      className="block h-full rounded-full bg-forest-700"
                      style={{ width: `${(s.avg / 5) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 text-right font-mono font-bold text-forest-900">{s.avg.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Review cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => {
          const meta = [
            r.cabin,
            r.route,
            r.date ? `Flew ${r.date.slice(0, 7)}` : null,
          ].filter(Boolean);
          const text = r.text.length > 300 ? `${r.text.slice(0, 297).trimEnd()}…` : r.text;
          return (
            <article
              key={r.id}
              className="flex flex-col rounded-[0.3rem] border border-forest-900/10 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <div className="flex items-center justify-between gap-3">
                {r.rating10 !== null && (
                  <span className="rounded-[0.3rem] bg-forest-900 px-2.5 py-1 font-mono text-xs font-bold text-sand-100">
                    {r.rating10}/10
                  </span>
                )}
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    r.recommended ? 'text-forest-700' : 'text-forest-900/40'
                  }`}
                >
                  {r.recommended ? 'Recommended' : 'Not recommended'}
                </span>
              </div>
              {r.title && (
                <h3 className="mt-3 font-urbanist text-base font-bold leading-snug text-forest-900">
                  {r.title.replace(/ customer review$/i, '')}
                </h3>
              )}
              {meta.length > 0 && (
                <p className="mt-1.5 text-[11px] uppercase tracking-wider text-forest-900/50">
                  {meta.join(' · ')}
                </p>
              )}
              <p className="mt-3 text-sm font-light leading-6 text-forest-900/78">{text}</p>
              <p className="mt-auto pt-4 text-xs text-forest-900/50">
                {r.author ?? 'Skytrax traveller'}
                {r.authorCountry ? `, ${r.authorCountry}` : ''}
              </p>
            </article>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-forest-900/50">
        Historical traveller reviews originally published on Skytrax (airlinequality.com), shown
        for reference — service standards may have changed since. Originfacts does not edit or
        verify individual reviews.
      </p>
    </section>
  );
}
