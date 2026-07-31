import {
  facetCounts,
  getAirlineReviews,
  pickRepresentative,
  ratingBands,
  SOURCE_META,
  SUBRATING_LABELS,
  sourceLabel,
  type AirlineReview,
  type AirlineReviewStats,
} from '@/lib/airline-reviews';

/**
 * Traveller reviews from the unified review store, which may hold reviews from
 * several sources at once (Skytrax archive, TripAdvisor…). Everything shown —
 * the histogram, the chips, the attribution — is counted from the stored
 * reviews, so the section never asserts more than the data supports.
 *
 * Layout follows a retail review block: rating summary with a star histogram on
 * the left, what travellers actually flew on the right, cards below, then a
 * link out to the full listing.
 */

const STAR_PATH = 'M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z';

function Stars({ value, size = 14, id }: { value: number; size?: number; id: string }) {
  // `value` is 0–5 and may be fractional, so each star is filled by percentage
  // rather than rounded — 4.4 reads as four full stars plus a partial.
  return (
    <span className="inline-flex items-center gap-[2px]" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        const gradientId = `star-${id}-${i}`;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" className="flex-none">
            <defs>
              <linearGradient id={gradientId}>
                <stop offset={`${fill * 100}%`} stopColor="#ffce00" />
                <stop offset={`${fill * 100}%`} stopColor="#e3e6ea" />
              </linearGradient>
            </defs>
            <path d={STAR_PATH} fill={`url(#${gradientId})`} />
          </svg>
        );
      })}
    </span>
  );
}

export default function AirlineReviews({ slug, name }: { slug: string; name: string }) {
  const data = getAirlineReviews(slug);
  if (!data || data.stats.reviewCount === 0) return null;

  const { stats } = data;
  const sources = data.sources ?? [];
  const bySource = data.statsBySource ?? {};
  const multiSource = sources.length > 1;

  const shown = pickRepresentative(data.reviews, 6);
  const bands = ratingBands(data.reviews);
  const maxBand = Math.max(...bands.map((b) => b.count), 1);
  const cabins = facetCounts(data.reviews, 'cabin', 5);
  const routes = facetCounts(data.reviews, 'route', 4);

  const years = `${stats.firstReviewDate.slice(0, 4)}–${stats.lastReviewDate.slice(0, 4)}`;
  const stars5 = stats.avgRating10 !== null ? stats.avgRating10 / 2 : null;
  const subs = stats.subratings
    ? Object.entries(stats.subratings).map(([k, v]) => ({ label: SUBRATING_LABELS[k] ?? k, avg: v }))
    : [];

  const linkFor = (source: string) =>
    (bySource[source] as AirlineReviewStats | undefined)?.sourceUrl ?? SOURCE_META[source]?.home ?? null;
  const primarySource = sources[0] ?? null;
  const primaryLink = primarySource ? linkFor(primarySource) : null;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-20" data-testid="airline-reviews">
      <div className="rounded-[0.3rem] border border-forest-900/10 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="editorial-h text-2xl font-bold text-forest-900 lg:text-[1.7rem]">
            Reviews of {name}
          </h2>
          <span className="text-xs uppercase tracking-[0.2em] text-forest-900/45">
            {sources.map(sourceLabel).join(' + ')} · {years}
          </span>
        </div>

        {/* Summary: score + histogram on the left, what was flown on the right */}
        <div className="mt-6 grid gap-8 border-b border-forest-900/10 pb-7 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
          <div className="flex flex-wrap items-start gap-x-9 gap-y-5">
            <div className="min-w-[118px]">
              {stars5 !== null && <Stars value={stars5} size={21} id="overall" />}
              {stats.avgRating10 !== null && (
                <div className="mt-2 font-urbanist text-[2.6rem] font-bold leading-none text-forest-900">
                  {stats.avgRating10.toFixed(1)}
                  <span className="text-lg font-semibold text-forest-900/40">/10</span>
                </div>
              )}
              <div className="mt-2 text-xs text-forest-900/55">
                {stats.reviewCount.toLocaleString()} review{stats.reviewCount === 1 ? '' : 's'}
              </div>

              {/* Only sources that record a recommend signal produce this line. */}
              {stats.recommendPct !== null && (
                <div className="mt-3 flex items-start gap-1.5 text-xs text-forest-900/70">
                  <span className="mt-[1px] font-bold text-success-emphasis">✓</span>
                  <span>
                    <span className="font-bold text-forest-900">{stats.recommendPct}%</span> would
                    recommend
                  </span>
                </div>
              )}
            </div>

            <ul className="min-w-[190px] flex-1 space-y-1.5">
              {bands.map((band) => (
                <li key={band.star} className="flex items-center gap-2.5 text-xs text-forest-900/60">
                  <span className="flex flex-none items-center gap-1 tabular-nums">
                    {band.star}
                    <svg width="11" height="11" viewBox="0 0 20 20" aria-hidden="true">
                      <path d={STAR_PATH} fill="#ffce00" />
                    </svg>
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-forest-900/[0.08]">
                    <span
                      className="block h-full rounded-full bg-forest-700"
                      style={{ width: `${(band.count / maxBand) * 100}%` }}
                    />
                  </span>
                  <span className="w-7 flex-none text-right tabular-nums text-forest-900/70">
                    {band.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-forest-900">What travellers flew</h3>
            <p className="mt-1 text-xs leading-5 text-forest-900/55">
              Counted from the {stats.reviewCount.toLocaleString()} review
              {stats.reviewCount === 1 ? '' : 's'} below — a tally of the flights reviewed, not a
              summary of what reviewers said.
            </p>

            {(cabins.length > 0 || routes.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {cabins.map((cabin) => (
                  <span
                    key={`cabin-${cabin.label}`}
                    className="rounded-full border border-forest-200 bg-forest-100/70 px-3 py-1 text-xs font-semibold text-forest-900/80"
                  >
                    {cabin.label} ({cabin.count})
                  </span>
                ))}
                {routes.map((route) => (
                  <span
                    key={`route-${route.label}`}
                    className="rounded-full border border-forest-900/10 bg-forest-900/[0.03] px-3 py-1 text-xs text-forest-900/65"
                  >
                    {route.label} ({route.count})
                  </span>
                ))}
              </div>
            )}

            {subs.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-bold text-forest-900">Category averages</h3>
                <ul className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {subs.map((sub) => (
                    <li key={sub.label} className="flex items-center gap-3 text-xs text-forest-900/65">
                      <span className="w-32 flex-none">{sub.label}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-forest-900/[0.08]">
                        <span
                          className="block h-full rounded-full bg-forest-500"
                          style={{ width: `${(sub.avg / 5) * 100}%` }}
                        />
                      </span>
                      <span className="w-7 text-right font-mono font-bold text-forest-900">
                        {sub.avg.toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {multiSource && (
              <dl className="mt-6 flex flex-wrap gap-x-7 gap-y-2">
                {sources.map((source) => {
                  const sourceStats = bySource[source];
                  if (!sourceStats) return null;
                  return (
                    <div key={source} className="text-xs">
                      <dt className="text-forest-900/50">{sourceLabel(source)}</dt>
                      <dd className="font-bold text-forest-900">
                        {sourceStats.avgRating10 !== null
                          ? `${sourceStats.avgRating10.toFixed(1)}/10`
                          : '—'}
                        <span className="font-normal text-forest-900/45">
                          {' '}
                          · {sourceStats.reviewCount}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </div>
        </div>

        {/* Review cards */}
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((review) => (
            <ReviewCard key={review.id} review={review} multiSource={multiSource} />
          ))}
        </div>

        {primaryLink && primarySource && (
          <div className="mt-7">
            <a
              href={primaryLink}
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="inline-flex items-center justify-center rounded-[0.3rem] bg-primary-emphasis px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-emphasisHover"
            >
              Read all reviews on {sourceLabel(primarySource)}
            </a>
          </div>
        )}

        <p className="mt-5 text-xs leading-5 text-forest-900/45">
          Traveller reviews originally published on{' '}
          {sources.map((source, i) => {
            const href = linkFor(source);
            return (
              <span key={source}>
                {i > 0 && (i === sources.length - 1 ? ' and ' : ', ')}
                {href ? (
                  <a href={href} rel="nofollow noopener noreferrer" target="_blank" className="underline">
                    {sourceLabel(source)}
                  </a>
                ) : (
                  sourceLabel(source)
                )}
              </span>
            );
          })}
          , shown for reference — service standards may have changed since. Originfacts does not edit
          or verify individual reviews, and the sample reflects who chose to leave one.
        </p>
      </div>
    </section>
  );
}

function ReviewCard({ review, multiSource }: { review: AirlineReview; multiSource: boolean }) {
  const tags = [
    review.cabin,
    review.route,
    review.date ? `Flew ${review.date.slice(0, 7)}` : null,
  ].filter(Boolean) as string[];

  const text = review.text.length > 300 ? `${review.text.slice(0, 297).trimEnd()}…` : review.text;
  const place = review.authorCountry ?? review.authorLocation ?? null;

  return (
    <article className="flex flex-col rounded-[0.3rem] border border-forest-900/10 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        {review.rating10 !== null && <Stars value={review.rating10 / 2} id={review.id} />}
        {/* Absent is not the same as "not recommended" — only sources that
            record the signal render this. */}
        {review.recommended !== null && review.recommended !== undefined && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              review.recommended ? 'text-success-emphasis' : 'text-forest-900/35'
            }`}
          >
            {review.recommended ? 'Recommended' : 'Not recommended'}
          </span>
        )}
      </div>

      {review.title && (
        <h3 className="mt-2.5 font-urbanist text-[0.95rem] font-bold leading-snug text-forest-900">
          {review.title.replace(/ customer review$/i, '')}
        </h3>
      )}

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-[0.2rem] border border-forest-900/10 px-1.5 py-0.5 text-[10px] font-medium text-forest-900/55"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-sm font-light leading-6 text-forest-900/75">{text}</p>

      <p className="mt-auto pt-4 text-xs text-forest-900/45">
        {review.author ?? 'Traveller'}
        {place ? `, ${place}` : ''}
        {multiSource && <span className="text-forest-900/30"> · {sourceLabel(review.source)}</span>}
      </p>
    </article>
  );
}
