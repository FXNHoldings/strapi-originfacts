import Link from 'next/link';
import type { StrapiAirline } from '@/lib/strapi';
import type { RouteFacts } from '@/lib/route-facts';
import type { AirlineFactsFile, FactField, FactFigure, ResolvedField, ResolvedModule } from '@/lib/airline-facts';
import { oldestVerifiedAt, resolveModule } from '@/lib/airline-facts';

/**
 * A module this component builds from a dataset the site already holds, rather
 * than from a fact file. It carries dataset provenance — a name and a vintage —
 * instead of per-field sources, because the whole module comes from one cited
 * dataset and there is no per-field claim to make about it.
 */
type DerivedCell = string | { text: string; href: string };

type DerivedModule = {
  id: string;
  title: string;
  /** Always a data vintage; derived modules are never human-verified. */
  verifiedAt: string;
  lede?: string;
  body?: string[];
  table?: { caption: string; columns: string[]; rows: DerivedCell[][] };
  conflicts?: { title: string; text: string }[];
  figure?: FactFigure;
  sources: { label: string; url?: string; note?: string }[];
};
import type { AirlineReviewFile } from '@/lib/airline-reviews';
import { facetCounts, ratingBands, sourceLabel, SOURCE_META } from '@/lib/airline-reviews';
import type { AirlineRef } from '@/lib/airline-refs';
import { AIRLINE_REF_SOURCE } from '@/lib/airline-refs';
import s from './AirlineTier1.module.css';

/**
 * The module running order, and where each one's content comes from.
 *
 * `facts` modules render only when the airline's file in content/airline-facts/
 * carries them — otherwise they render unpublished. `derived` modules are built
 * here from data already on the site (route-network facts), and cite it.
 */
/**
 * Traveller ratings are withheld from the template.
 *
 * The store holds 202 carriers' worth of TripAdvisor reviews, none newer than
 * December 2023. Publishing a 4.3/10 aggregate about a named company off data
 * that old is a reputational claim on stale evidence, and a caveat printed
 * under the number does not undo the number. Separately, TripAdvisor's terms
 * restrict scraping and republishing aggregate ratings to licensed partners
 * with specific attribution — which this is not.
 *
 * Flip to true only when the corpus has a current, licensed source.
 */
const REVIEWS_MODULE_ENABLED = false;

const LAYOUT: { id: string; title: string; nav: string; from: 'facts' | 'derived' | 'either' }[] = [
  { id: 'baggage', title: 'Checked baggage', nav: 'Baggage', from: 'facts' },
  { id: 'carryon', title: 'Carry-on', nav: 'Carry-on', from: 'facts' },
  { id: 'fares', title: 'What the cheapest fare includes', nav: 'Fares', from: 'facts' },
  { id: 'cabins', title: 'Cabins and seating', nav: 'Cabins & seating', from: 'derived' },
  { id: 'rights', title: 'If your flight is delayed or cancelled', nav: 'Passenger rights', from: 'facts' },
  { id: 'checkin', title: 'Check-in and airport cutoffs', nav: 'Check-in', from: 'facts' },
  // Contact is derived from Strapi and the Duffel snapshot by default, but a
  // fact file can override it. Neither source carries provenance — Strapi's
  // fields have no recorded origin and the snapshot is a third party — so a
  // sourced, dated entry in the fact file should win over both.
  { id: 'contact', title: 'Contact and the small print', nav: 'Contact', from: 'either' },
  { id: 'network', title: 'Where they fly', nav: 'Where they fly', from: 'derived' },
  ...(REVIEWS_MODULE_ENABLED
    ? [{ id: 'reviews', title: 'What travellers rate it', nav: 'Reviews', from: 'derived' as const }]
    : []),
  { id: 'faq', title: 'Common questions', nav: 'FAQ', from: 'derived' },
];

/** Why a `facts` module has nothing to show yet, in the reader's terms. */
const PENDING_COPY: Record<string, string> = {
  baggage:
    'Checked allowances differ by route band and cabin, and none have been verified against this airline’s published conditions of carriage yet.',
  carryon: 'Cabin-bag size and weight limits have not been verified against the airline’s current published allowance.',
  fares: 'Fare-tier inclusions have not been verified against the airline’s published fare conditions.',
  rights:
    'Which delay and cancellation regime applies depends on where each flight departs. The mapping has not been verified for this carrier yet.',
  checkin: 'Online check-in windows and airport bag-drop cutoffs have not been verified against the airline’s published times.',
};

export type AirlineTier1Props = {
  airline: StrapiAirline;
  routeFacts: RouteFacts | null;
  facts: AirlineFactsFile | null;
  alliance: string | null;
  /** Ingested review store entry, when this carrier has one. */
  reviews?: AirlineReviewFile | null;
  /** Duffel reference snapshot entry — carries the conditions-of-carriage link. */
  airlineRef?: AirlineRef | null;
  /** Rendered when the page is showing the design's unverified sample content. */
  sampleNotice?: string | null;
};

export default function AirlineTier1({
  airline,
  routeFacts,
  facts,
  alliance,
  reviews = null,
  airlineRef = null,
  sampleNotice,
}: AirlineTier1Props) {
  /**
   * IATA only. The directory's ICAO codes are not trustworthy: they were
   * written by an enrichment pass that resolved Wikidata by IATA code, and an
   * IATA code is shared across a carrier's group — "QF" returns Qantas Airways
   * (QFA), Eastern Australia Airlines (EAQ), Qantas Freight, Jetconnect and
   * others. Qantas was stamped EAQ, Singapore Airlines SQC (its cargo arm),
   * Air New Zealand RLK (Air Nelson). Same rule as every module here: no
   * source, no render. Restore the code once a verified ICAO lands.
   */
  const codes = airline.iataCode ?? '';
  const sourced = new Map((facts?.modules ?? []).map((m) => [m.id, resolveModule(m)]));

  const derived: Record<string, DerivedModule | null> = {
    cabins: cabinsModule(airline, routeFacts),
    contact: contactModule(airline, airlineRef),
    network: networkModule(airline, routeFacts),
    reviews: REVIEWS_MODULE_ENABLED ? reviewsModule(airline, reviews) : null,
    faq: null, // rendered by its own component below
  };

  const faqs = derivedFaqs(airline, routeFacts, alliance);

  const rendered = LAYOUT.map((entry) => {
    const fromFile = entry.from !== 'derived' ? sourced.get(entry.id) ?? null : null;
    // 'either' prefers the fact file and falls back to the derived module, so a
    // carrier without a contact entry still gets what Strapi and Duffel know.
    const fromCode = entry.from !== 'facts' && !fromFile?.isPublished ? derived[entry.id] ?? null : null;
    return { ...entry, sourced: fromFile, derived: fromCode };
  });

  // Verified counts only fact-file modules that actually published. Derived
  // modules carry a dataset vintage, not a verification, and are counted apart
  // so the ledger cannot imply someone checked them.
  const publishedSourced = rendered.map((r) => r.sourced).filter((m): m is ResolvedModule => Boolean(m?.isPublished));
  const derivedCount = rendered.filter((r) => r.derived).length;
  const disputedCount = rendered.filter((r) => r.sourced && r.sourced.disputes.length > 0).length;
  const pendingCount = rendered.filter((r) => r.id !== 'faq' && !r.derived && !r.sourced?.isPublished).length;
  const lastReview = oldestVerifiedAt(publishedSourced);

  const hubs = (routeFacts?.topHubs ?? []).slice(0, 4).map((h) => h.city);
  const fleetTypes = routeFacts?.fleet ?? [];

  const plate: { label: string; value: string }[] = [
    airline.iataCode ? { label: 'IATA', value: airline.iataCode } : null,
    alliance ? { label: 'Alliance', value: alliance } : null,
    airline.founded ? { label: 'Founded', value: String(airline.founded) } : null,
    hubs.length ? { label: 'Top hubs', value: hubs.join(' · ') } : null,
      // Route data names the aircraft TYPES seen on a carrier's routes, not how
    // many airframes it has, and it accumulates retired equipment — labelled
    // as types on record rather than passed off as a fleet count.
    fleetTypes.length ? { label: 'Types on record', value: String(fleetTypes.length) } : null,
    routeFacts?.destinationCount ? { label: 'Destinations', value: String(routeFacts.destinationCount) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const eyebrow = ['Airline reference', airline.country, airline.type].filter(Boolean).join(' · ');

  return (
    // `airline-page-<slug>` is what globals.css keys off to hide the fixed
    // left/right rails on airline pages — the old layout and the showcase both
    // set it, so this template matches rather than adding a second mechanism.
    <div className={s.root} data-testid={`airline-page-${airline.slug}`}>
      {sampleNotice && (
        <div className={s.sampleBanner}>
          <div className={s.wrap}>{sampleNotice}</div>
        </div>
      )}

      <header className={s.hero}>
        <div className={s.wrap}>
          <div className={s.plate}>
            <div>
              <div className={s.eyebrow}>{eyebrow}</div>
              <h1>
                {airline.name}
                {codes && <span className={s.code}>{codes}</span>}
              </h1>
              {airline.shortDescription?.trim() && <p className={s.standfirst}>{airline.shortDescription.trim()}</p>}
            </div>
            {plate.length > 0 && (
              <dl className={s.codes}>
                {plate.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <nav className={s.modnav}>
            {rendered.map((r) => (
              <a key={r.id} href={`#${r.id}`}>
                {r.nav}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className={s.ledger}>
        <div className={`${s.wrap} ${s.ledgerInner}`}>
          <span className={s.ledgerLabel}>Data status</span>
          {publishedSourced.length > 0 && (
            <span className={`${s.pip} ${s.pipOk}`}>{publishedSourced.length} verified</span>
          )}
          {derivedCount > 0 && <span className={`${s.pip} ${s.pipPending}`}>{derivedCount} from data</span>}
          {disputedCount > 0 && <span className={`${s.pip} ${s.pipWarn}`}>{disputedCount} need re-check</span>}
          {pendingCount > 0 && <span className={`${s.pip} ${s.pipPending}`}>{pendingCount} unpublished</span>}
          {lastReview ? (
            <span className={`${s.ledgerLabel} ${s.ledgerRight}`}>Last verified {formatDate(lastReview)}</span>
          ) : (
            <span className={`${s.ledgerLabel} ${s.ledgerRight}`}>No modules verified yet</span>
          )}
        </div>
      </div>

      <main className={s.main}>
        <div className={`${s.wrap} ${s.cols}`}>
          <div>
            {rendered.map((r) =>
              r.id === 'faq' ? (
                <FaqModule key="faq" faqs={faqs} />
              ) : r.derived ? (
                <DerivedModuleView key={r.id} module={r.derived} />
              ) : r.sourced?.isPublished ? (
                <SourcedModuleView key={r.id} module={r.sourced} />
              ) : (
                <PendingModule
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  blockers={r.sourced?.blockers ?? []}
                  disputes={r.sourced?.disputes ?? []}
                />
              ),
            )}
          </div>

          <aside className={s.rail}>
            <div className={s.railBlock}>
              <h3>Verification ledger</h3>
              <ul>
                {rendered
                  .filter((r) => r.id !== 'faq')
                  .map((r) => (
                    <li key={r.id}>
                      <a href={`#${r.id}`}>{r.title}</a>
                      <span className={s.when}>
                        {r.derived
                          ? `data ${formatDate(r.derived.verifiedAt)}`
                          : r.sourced?.isPublished
                            ? formatDate(r.sourced.verified_at ?? '')
                            : r.sourced?.disputes.length
                              ? 'disputed'
                              : 'pending'}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className={s.railBlock}>
              <h3>Elsewhere on Originfacts</h3>
              <ul>
                <li>
                  <Link href="/flight-routes">Flight routes</Link>
                </li>
                <li>
                  <Link href="/airlines">Airline directory</Link>
                </li>
                {airline.country && (
                  <li>
                    <Link href="/destinations">Destinations</Link>
                  </li>
                )}
              </ul>
            </div>

            <div className={s.railBlock}>
              <h3>How we source this</h3>
              <p className={s.byline}>
                <strong>Originfacts Editorial</strong>
                <br />
                Every figure on this page comes from the airline’s own published conditions of carriage, a named regulator,
                or a dataset we cite. Where sources disagree we say so and print neither number. Where a figure isn’t
                verified, the module doesn’t publish.
              </p>
              {airlineRef?.conditionsOfCarriageUrl && (
                <p className={s.byline}>
                  <a href={airlineRef.conditionsOfCarriageUrl} target="_blank" rel="noopener noreferrer nofollow">
                    {airline.name} conditions of carriage →
                  </a>
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>

      <div className={s.pagefoot}>
        <div className={s.wrap}>
          Originfacts · Airline reference · Figures change without notice — always confirm on the airline’s own site before
          you travel.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Module renderers
 * ------------------------------------------------------------------ */

/**
 * A module built from a fact file. Reaches here only when every required field
 * resolved `official`, so each cell already has its own source and date.
 */
function SourcedModuleView({ module: m }: { module: ResolvedModule }) {
  const sources = collectSources(m);
  return (
    <section className={s.module} id={m.id} data-testid={`t1-module-${m.id}`}>
      <div className={s.moduleHead}>
        <h2>{m.title}</h2>
        <span className={`${s.stamp} ${s.stampOk}`}>
          {m.verified_at ? `Verified ${formatDate(m.verified_at)}` : 'Verified'}
        </span>
      </div>

      {m.lede && <p className={s.lede}>{m.lede}</p>}
      {m.body?.map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      {m.table && (
        <div className={s.tableScroll}>
          <table>
            <caption>{m.table.caption}</caption>
            <thead>
              <tr>
                {m.table.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.table.rows.map((row, i) => (
                <tr key={i}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((field, j) => (
                    <td key={j} className={s.num}>
                      <FieldValue field={field} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fields not laid out in a table still have to render. Most modules
          carry a handful of values and no table at all, and before this they
          drew a header and a verified stamp over an empty body. */}
      {m.published.length > 0 && !m.table && (
        <dl className={s.fieldList}>
          {m.published.map((f) => (
            <div key={f.key}>
              <dt>{f.label}</dt>
              <dd>
                <FieldValue field={f.field} />
                {f.field.notes && <span className={s.fieldNote}>{f.field.notes}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {m.rule && (
        <div className={s.ruleBox}>
          <span className={s.ruleKey}>{m.rule.key}</span>
          <p>{m.rule.text}</p>
        </div>
      )}

      {/* Disagreements are stated, never resolved. Picking the more common
          reading would hide from the reader that a choice was made at all. */}
      {m.disputes.map((d) => (
        <div key={d.key} className={s.conflict}>
          <h4>Sources disagree — {d.label}</h4>
          <p>
            {d.field.notes ??
              `Credible sources give different values${
                d.field.conflicting_values?.length ? `: ${d.field.conflicting_values.join(' / ')}` : ''
              }. Neither is published until it can be confirmed.`}
          </p>
        </div>
      ))}

      <div className={s.src}>
        <strong>Sources</strong>
        {sources.map((src, i) => (
          <span key={i}>
            <a href={src.url} target="_blank" rel="noopener noreferrer nofollow">
              {src.host}
            </a>
            {` — ${src.fields.join(', ')}, verified ${formatDate(src.verified_at)}`}
            <br />
          </span>
        ))}
      </div>
    </section>
  );
}

/** A field that is its own evidence renders as its link, not as text beside one. */
function FieldValue({ field }: { field: FactField | null }) {
  if (!field?.value) return <>—</>;
  if (/^https?:\/\//.test(field.value)) {
    return (
      <a href={field.value} target="_blank" rel="noopener noreferrer nofollow">
        {field.value.replace(/^https?:\/\//, '')}
      </a>
    );
  }
  return <>{field.value}</>;
}

/**
 * One line per source URL, naming the fields that came from it.
 *
 * Grouped by URL rather than listed per field so a table of six values from one
 * carrier page reads as one citation — while a value from a different page
 * still stands out as its own line, which is the case that matters when
 * markets differ per URL.
 */
function collectSources(m: ResolvedModule): { url: string; host: string; fields: string[]; verified_at: string }[] {
  const byUrl = new Map<string, { url: string; host: string; fields: string[]; verified_at: string }>();

  // Every official field, however it renders. Reading only table cells left a
  // module with fields and no table showing an empty "Sources" block, which is
  // worse than showing none — it claims a citation exists and shows nothing.
  for (const { label, field } of m.published) {
    if (!field.source_url || !field.verified_at) continue;
    let host: string;
    try {
      host = new URL(field.source_url).host;
    } catch {
      host = field.source_url;
    }
    const entry = byUrl.get(field.source_url) ?? {
      url: field.source_url,
      host,
      fields: [],
      verified_at: field.verified_at,
    };
    entry.fields.push(label);
    if (field.verified_at < entry.verified_at) entry.verified_at = field.verified_at;
    byUrl.set(field.source_url, entry);
  }
  return [...byUrl.values()];
}

/** A module built from a dataset the site holds, citing the dataset. */
function DerivedModuleView({ module: m }: { module: DerivedModule }) {
  return (
    <section className={s.module} id={m.id} data-testid={`t1-module-${m.id}`}>
      <div className={s.moduleHead}>
        <h2>{m.title}</h2>
        <span className={`${s.stamp} ${s.stampPending}`}>Data as of {formatDate(m.verifiedAt)}</span>
      </div>

      {m.lede && <p className={s.lede}>{m.lede}</p>}
      {m.body?.map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      {m.table && (
        <div className={s.tableScroll}>
          <table>
            <caption>{m.table.caption}</caption>
            <thead>
              <tr>
                {m.table.columns.map((c, i) => (
                  <th key={i} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th key={j} scope="row">
                        <Cell cell={cell} />
                      </th>
                    ) : (
                      <td key={j}>
                        <Cell cell={cell} />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {m.figure && <Figure figure={m.figure} />}

      {m.conflicts?.map((c, i) => (
        <div key={i} className={s.conflict}>
          <h4>{c.title}</h4>
          <p>{c.text}</p>
        </div>
      ))}

      <div className={s.src}>
        <strong>Sources</strong>
        {m.sources.map((src, i) => (
          <span key={i}>
            {src.url ? (
              <a href={src.url} target="_blank" rel="noopener noreferrer nofollow">
                {src.label}
              </a>
            ) : (
              src.label
            )}
            {src.note ? ` — ${src.note}` : ''}
            <br />
          </span>
        ))}
      </div>
    </section>
  );
}

/**
 * The two ways a module can fail to publish, rendered as visibly different
 * states rather than one shared block.
 *
 * Not yet verified and sources actively disagree are different facts about the
 * world, and collapsing them tells the reader something untrue in one direction
 * or the other — either that we checked and found a conflict when we never
 * checked, or that we simply have not got to it when in fact the sources fight.
 *
 * Unpublished is a dashed, grey, quiet box: work not done.
 * Disputed is a solid, amber-ruled box naming both readings: work done, and the
 * answer is that there is no single answer.
 */
function PendingModule({
  id,
  title,
  blockers,
  disputes,
}: {
  id: string;
  title: string;
  blockers: { key: string; status: string }[];
  disputes: ResolvedField[];
}) {
  if (disputes.length > 0) {
    return (
      <section className={`${s.module} ${s.isDisputed}`} id={id} data-testid={`t1-disputed-${id}`}>
        <div className={s.moduleHead}>
          <h2>{title}</h2>
          <span className={`${s.stamp} ${s.stampWarn}`}>Sources disagree</span>
        </div>
        <p className={s.pendingNote}>
          Credible sources give different answers here, so nothing is published. Both readings are below — we would
          rather show you the disagreement than pick one and let it look settled.
        </p>
        {disputes.map((d) => (
          <div key={d.key} className={s.conflict}>
            <h4>{d.label}</h4>
            <p>
              {d.field.conflicting_values?.length ? (
                <>
                  <strong>{d.field.conflicting_values.join('  ·  ')}</strong>
                  <br />
                </>
              ) : null}
              {d.field.notes ?? 'Neither value is published until it can be confirmed against the carrier’s own page.'}
            </p>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className={`${s.module} ${s.isPending}`} id={id} data-testid={`t1-pending-${id}`}>
      <div className={s.moduleHead}>
        <h2>{title}</h2>
        <span className={`${s.stamp} ${s.stampPending}`}>Not yet verified</span>
      </div>
      <p className={s.pendingNote}>
        {PENDING_COPY[id] ?? 'This module has not been verified against a published source yet.'}
        {blockers.length > 0 && (
          <>
            {' '}
            Waiting on: {blockers.map((b) => `${b.key.replace(/_/g, ' ')} (${b.status})`).join(', ')}.
          </>
        )}{' '}
        It renders once every required field carries a source and a date — see <code>content/airline-facts/</code>.
      </p>
    </section>
  );
}

function FaqModule({ faqs }: { faqs: { q: string; a: string }[] }) {
  if (!faqs.length) return null;
  return (
    <section className={s.module} id="faq" data-testid="t1-module-faq">
      <div className={s.moduleHead}>
        <h2>Common questions</h2>
        <span className={`${s.stamp} ${s.stampOk}`}>Marked up as FAQPage</span>
      </div>
      {faqs.map((f, i) => (
        <details key={i} open={i === 0}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Modules derived from route-network data
 *
 * Every sentence below is composed from a field that is present; nothing is
 * asserted that the dataset does not carry. The dataset is cited by name and
 * by its own `updated` stamp, so these modules meet the same bar as the file
 * store rather than getting a free pass for being generated.
 * ------------------------------------------------------------------ */

function factsSource(rf: RouteFacts) {
  return [{ label: `Originfacts route-network dataset, built from ${rf.source}`, note: `updated ${rf.updated}` }];
}

function cabinsModule(a: StrapiAirline, rf: RouteFacts | null): DerivedModule | null {
  if (!rf || rf.fleet.length === 0) return null;
  return {
    id: 'cabins',
    title: 'Cabins and seating',
    verifiedAt: `${rf.updated}-01`,
    body: [
      // Attributed to the dataset rather than asserted as current fact: the
      // route data is cumulative and lists equipment carriers have since
      // retired, so "X operates these types" would frequently be wrong.
      `The routes we hold for ${a.name} name ${rf.fleet.length} aircraft type${rf.fleet.length === 1 ? '' : 's'}: ${listSentence(rf.fleet)}.`,
      'Seat pitch is a property of the aircraft cabin rather than of the airline, so a single figure for this carrier’s legroom would be misleading. Pitch publishes per aircraft type once each figure is verified.',
    ],
    sources: factsSource(rf),
    conflicts: [
      {
        title: 'Read this list as history, not as a current fleet',
        text: `The route dataset accumulates equipment over time and is not a fleet register — it can name types ${a.name} has since retired, and it will miss recent additions. A verified current fleet is a separate piece of sourcing.`,
      },
      {
        title: 'Not yet published',
        text: 'Seat pitch and cabin configuration per aircraft type are not verified for this carrier yet, so no numbers appear above.',
      },
    ],
  };
}

function networkModule(a: StrapiAirline, rf: RouteFacts | null): DerivedModule | null {
  if (!rf || rf.destinationCount === 0) return null;
  const body: string[] = [
    `We track ${rf.routeCount.toLocaleString()} ${a.name} route${rf.routeCount === 1 ? '' : 's'} serving ${rf.destinationCount} destination${rf.destinationCount === 1 ? '' : 's'} across ${rf.countryCount} ${rf.countryCount === 1 ? 'country' : 'countries'}.`,
  ];
  if (rf.topHubs.length) {
    body.push(`Its busiest airports by route count are ${listSentence(rf.topHubs.map((h) => `${h.city} (${h.routes})`))}.`);
  }

  return {
    id: 'network',
    title: 'Where they fly',
    verifiedAt: `${rf.updated}-01`,
    lede: rf.keyDestinations.length
      ? `Best known for ${listSentence(rf.keyDestinations.slice(0, 6))}.`
      : undefined,
    body,
    // The longest sector moves out of the prose and into the diagram below —
    // repeating it in both would state the same fact twice on one screen.
    figure: rf.longestRoute
      ? {
          kind: 'longest-sector',
          fromCity: rf.longestRoute.from,
          fromIata: rf.longestRoute.fromIata,
          toCity: rf.longestRoute.to,
          toIata: rf.longestRoute.toIata,
          km: rf.longestRoute.km,
        }
      : undefined,
    sources: factsSource(rf),
  };
}

function derivedFaqs(a: StrapiAirline, rf: RouteFacts | null, alliance: string | null): { q: string; a: string }[] {
  const faqs: { q: string; a: string }[] = [];
  if (rf?.destinationCount) {
    faqs.push({
      q: `How many destinations does ${a.name} fly to?`,
      a: `Originfacts tracks ${rf.destinationCount} ${a.name} destination${rf.destinationCount === 1 ? '' : 's'} across ${rf.countryCount} ${rf.countryCount === 1 ? 'country' : 'countries'}, on ${rf.routeCount.toLocaleString()} route${rf.routeCount === 1 ? '' : 's'}.`,
    });
  }
  if (rf?.topHubs.length) {
    faqs.push({
      q: `Where is ${a.name} based?`,
      a: `By route count its busiest airport is ${rf.topHubs[0].city}${rf.topHubs.length > 1 ? `, followed by ${listSentence(rf.topHubs.slice(1, 4).map((h) => h.city))}` : ''}.`,
    });
  }
  if (rf?.fleet.length) {
    faqs.push({
      q: `What aircraft appear on ${a.name} routes?`,
      a: `The routes we hold name ${listSentence(rf.fleet)}. That dataset accumulates over time, so treat it as a record of what has flown rather than a current fleet list.`,
    });
  }
  if (rf?.longestRoute) {
    faqs.push({
      q: `What is the longest ${a.name} route?`,
      a: `${rf.longestRoute.from} to ${rf.longestRoute.to}, at ${rf.longestRoute.km.toLocaleString()} km.`,
    });
  }
  if (alliance) {
    faqs.push({ q: `Which alliance is ${a.name} in?`, a: `${a.name} is a member of ${alliance}.` });
  }
  return faqs;
}

/**
 * The longest sector, drawn.
 *
 * A great-circle sector is the one fact on these pages that a sentence
 * genuinely under-serves — "13,400 km" means little until you see it as an arc
 * across a hemisphere. The geometry is schematic, not a projection: the arc is
 * a fixed curve, so it reads the same for every carrier and never implies a
 * routing accuracy the dataset does not carry.
 *
 * Everything stated is in the data — both cities, both IATA codes, and a
 * distance the upstream generator computes with a haversine over the two
 * airports' coordinates, which is what makes "great-circle" accurate rather
 * than decorative.
 */
function Figure({ figure }: { figure: FactFigure }) {
  const { fromCity, fromIata, toCity, toIata, km } = figure;
  const distance = `${km.toLocaleString()} km`;
  const label = `${fromCity} (${fromIata}) to ${toCity} (${toIata}), ${distance} great-circle distance.`;

  return (
    <figure className={s.sector}>
      <div className={s.sectorText}>
        <p className={s.sectorEyebrow}>Longest nonstop route</p>
        <p className={s.sectorRoute}>
          {fromCity} <span aria-hidden>→</span> {toCity}
        </p>
        <p className={s.sectorMeta}>
          {distance} · {fromIata} <span aria-hidden>→</span> {toIata}
        </p>
        <figcaption className={s.sectorCaption}>
          The longest sector in this carrier’s network as recorded in our route dataset, measured as the great-circle
          distance between the two airports.
        </figcaption>
      </div>

      <div className={s.sectorPlot}>
        <svg viewBox="0 0 420 190" className={s.sectorSvg} role="img" aria-label={label}>
          <defs>
            <linearGradient id="t1-sector-arc" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--sector-from)" />
              <stop offset="100%" stopColor="var(--sector-to)" />
            </linearGradient>
          </defs>
          <path
            d="M 62 148 Q 210 34 358 148"
            fill="none"
            stroke="url(#t1-sector-arc)"
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinecap="round"
          />
          <text x="210" y="112" className={s.sectorDistance} textAnchor="middle">
            {distance}
          </text>
          <circle cx="62" cy="148" r="6.5" fill="var(--sector-from)" />
          <circle cx="358" cy="148" r="6.5" fill="var(--sector-to)" />
          <text x="62" y="174" className={s.sectorCode} textAnchor="middle">
            {fromIata}
          </text>
          <text x="358" y="174" className={s.sectorCode} textAnchor="middle">
            {toIata}
          </text>
        </svg>
      </div>
    </figure>
  );
}

/** A cell that is its own source renders as the link, not as text beside one. */
function Cell({ cell }: { cell: DerivedCell }) {
  if (typeof cell === 'string') return <>{cell}</>;
  return (
    <a href={cell.href} target="_blank" rel="noopener noreferrer nofollow">
      {cell.text}
    </a>
  );
}

/**
 * Contact details that are their own evidence.
 *
 * Only rows a reader can click through and check themselves are printed. The
 * directory also holds a registered address and a customer-service number for
 * many carriers, but nothing records where those came from — so they are named
 * as unverified rather than laid out as facts.
 */
function contactModule(a: StrapiAirline, ref: AirlineRef | null): DerivedModule | null {
  const rows: DerivedCell[][] = [];
  const website = a.website ? (a.website.startsWith('http') ? a.website : `https://${a.website}`) : null;

  if (website) rows.push(['Official website', { text: website.replace(/^https?:\/\//, ''), href: website }]);
  if (ref?.conditionsOfCarriageUrl) {
    rows.push(['Conditions of carriage', { text: 'Published terms', href: ref.conditionsOfCarriageUrl }]);
  }
  if (a.frequentFlyerProgram) {
    rows.push([
      'Frequent flyer',
      a.frequentFlyerUrl ? { text: a.frequentFlyerProgram, href: a.frequentFlyerUrl } : a.frequentFlyerProgram,
    ]);
  }
  if (rows.length === 0) return null;

  const sources: DerivedModule['sources'] = [{ label: `${a.name} official website`, note: 'linked above' }];
  if (ref?.conditionsOfCarriageUrl) {
    sources.push({ label: `${AIRLINE_REF_SOURCE.label()}`, note: `retrieved ${AIRLINE_REF_SOURCE.retrieved()}` });
  }

  const unverified = [
    a.phone ? 'a customer-service number' : '',
    a.address ? 'a registered address' : '',
  ].filter((v): v is string => v.length > 0);

  return {
    id: 'contact',
    title: 'Contact and the small print',
    verifiedAt: ref?.conditionsOfCarriageUrl ? AIRLINE_REF_SOURCE.retrieved() : '2026-08-24',
    body: [
      'Every row here is a link you can open and check for yourself, which is the only kind of contact detail worth printing on a reference page — numbers and addresses go stale quietly.',
    ],
    table: { caption: 'Where to check the airline’s own terms', columns: ['', 'Link'], rows },
    conflicts: unverified.length
      ? [
          {
            title: 'Held but not published',
            text: `Our directory also lists ${listSentence(unverified)} for ${a.name}, but nothing records where those came from or when they were last checked, so they are not printed here.`,
          },
        ]
      : undefined,
    sources,
  };
}

/**
 * Traveller ratings from the ingested review store.
 *
 * `verifiedAt` is the date of the most recent review, not the date the page was
 * built — a rating set is exactly as current as its newest entry, and printing
 * today's date over three-year-old reviews would be the kind of false freshness
 * this template exists to avoid.
 */
function reviewsModule(a: StrapiAirline, file: AirlineReviewFile | null): DerivedModule | null {
  if (!file || !file.reviews.length || file.stats.avgRating10 === null) return null;
  const { stats } = file;

  const bands = ratingBands(file.reviews).filter((b) => b.count > 0);
  const cabins = facetCounts(file.reviews, 'cabin', 4);

  const body: string[] = [
    `Across ${stats.reviewCount.toLocaleString()} review${stats.reviewCount === 1 ? '' : 's'}, ${a.name} averages ${stats.avgRating10}/10. These are travellers' own scores — we count them, we do not summarise or interpret what they wrote.`,
  ];
  if (cabins.length) {
    body.push(
      `Reviews naming a cabin break down as ${listSentence(cabins.map((c) => `${c.label} (${c.count}${c.avg !== null ? `, averaging ${c.avg}` : ''})`))}.`,
    );
  }

  const monthsOld = monthsSince(stats.lastReviewDate);
  const stale = monthsOld !== null && monthsOld >= 18;

  return {
    id: 'reviews',
    title: 'What travellers rate it',
    verifiedAt: stats.lastReviewDate,
    lede: `${stats.avgRating10}/10 across ${stats.reviewCount.toLocaleString()} collected review${stats.reviewCount === 1 ? '' : 's'}.`,
    body,
    table: bands.length
      ? {
          caption: `Score distribution · reviews collected ${formatDate(stats.firstReviewDate)} to ${formatDate(stats.lastReviewDate)}`,
          columns: ['Rating', 'Reviews', 'Share'],
          rows: bands.map((b) => [
            `${b.star} star${b.star === 1 ? '' : 's'}`,
            String(b.count),
            `${Math.round((b.count / file.reviews.length) * 100)}%`,
          ]),
        }
      : undefined,
    conflicts: stale
      ? [
          {
            title: 'Ratings are ageing',
            text: `The newest review here is from ${formatDate(stats.lastReviewDate)}. Scores that old describe the airline as it was, not necessarily as it is — read them as history until the store is refreshed.`,
          },
        ]
      : undefined,
    sources: file.sources.map((src) => ({
      label: `${sourceLabel(src)} — reader reviews`,
      url: file.statsBySource?.[src]?.sourceUrl ?? SOURCE_META[src]?.home,
      note: `${file.statsBySource?.[src]?.reviewCount ?? stats.reviewCount} reviews`,
    })),
  };
}

/** Whole months between an ISO date and 24 Aug 2026, the snapshot date. */
function monthsSince(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return null;
  return (2026 - Number(m[1])) * 12 + (8 - Number(m[2]));
}

/* ------------------------------------------------------------------ */

function listSentence(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "2026-08-24" → "24 Aug 2026"; "2026-07-01" from a YYYY-MM stamp → "Jul 2026". */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(m) - 1] ?? '';
  if (!d || d === '01') return `${month} ${y}`;
  return `${Number(d)} ${month} ${y}`;
}

export { derivedFaqs };
