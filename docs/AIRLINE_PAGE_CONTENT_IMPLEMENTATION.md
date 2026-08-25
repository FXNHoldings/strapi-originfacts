# Airline page content implementation

This document describes how OriginFacts builds useful, SEO-oriented airline
reference pages without publishing unsourced or ambiguous facts. It covers the
page implementation and the content pipeline from initial carrier setup through
fetching, extraction, review, preview, approval, and publication.

## Objective

The airline pages should answer practical traveller questions about:

- carry-on and personal-item limits;
- checked baggage allowances, dimensions, and fees;
- fares and what the cheapest fare includes;
- online check-in and airport cutoffs;
- cabins and seating;
- passenger rights and conditions of carriage; and
- official contact details and correspondence channels.

These are reference pages, not generic airline descriptions. Their value comes
from field-level provenance: every published figure must identify the official
page it came from and when it was verified.

The current pipeline is configured for **75 carriers and 450 source-page
entries** in `ops/fetch/carriers.json`.

## Page architecture

| Concern | Location |
|---|---|
| Live airline route | `app/airlines/[slug]/page.tsx` |
| Airline-template preview | `app/preview/airlines/[slug]/page.tsx` |
| Proposal-review preview | `app/preview/airline-facts-review/page.tsx` |
| Page renderer | `components/airline-tier1/AirlineTier1.tsx` |
| Renderer styles | `components/airline-tier1/AirlineTier1.module.css` |
| Fact loader and schema types | `lib/airline-facts.ts` |
| Published fact store | `content/airline-facts/<slug>.json` |
| Fact validator | `ops/validate-airline-facts.mjs` |
| Fetch and processing pipeline | `ops/fetch/` |

The preview routes must remain `noindex`. Previewing data is not editorial
approval, and a proposal must never become searchable merely because it can be
rendered.

The review page uses two levels of collapsed disclosure:

1. one dropdown per airline; and
2. nested dropdowns for Carry-on, Checked baggage, Check-in, and other modules.

This keeps carriers with many candidates, such as American Airlines, compact
without removing their evidence or source links.

## Source-of-truth rules

The published source of truth is `content/airline-facts/`. Generated captures,
candidates, interpretations, and review artifacts are not published facts.

The following rules are mandatory:

1. A failed lookup produces `null` with status `pending`, never a plausible
   default.
2. Every field with status `official` has a non-empty value, `source_url`, and
   `verified_at`.
3. Verification precision is not widened. A source that supplies only a year
   is stored as a year.
4. Conflicting credible values are stored as `disputed`; neither value is
   silently selected for publication.
5. Existing `official` values are not overwritten without a new source and
   verification date.
6. Contact phone numbers and addresses must be sourced from the carrier's own
   registrable domain.
7. IATA codes are display identifiers, not safe entity joins. Carrier identity
   must use a durable identifier such as a reviewed entity mapping, Wikidata
   QID, or ICAO code.
8. A module publishes only when all of its required fields are official.

Run validation before every build or proposed publication:

```bash
yarn validate:facts
yarn validate:facts:fixtures
```

`yarn build` runs the fact-store validation automatically through `prebuild`.

## End-to-end workflow

The processing model is:

```text
carrier configuration
  -> preflight
  -> archival fetch
  -> selector discovery and approval
  -> offline candidate extraction
  -> non-destructive draft proposal
  -> conservative interpretation
  -> review report and preview facts
  -> human approval
  -> citation proof and validation
  -> preview QA
  -> controlled publication
```

No stage before human approval writes official fields into the published fact
store.

### 1. Configure carriers and source pages

Add or update the carrier in `ops/fetch/carriers.json`. Each carrier requires a
`carrier_key`, locale, and named page URLs. Page keys currently include:

- `baggage_carryon`;
- `baggage_checked`;
- `baggage_fees`;
- `checkin`;
- `fare_conditions`;
- `conditions_of_carriage`; and
- `fleet_seatmaps` where a reviewed source is available.

Locale is an assertion about the intended market. Airline rules genuinely vary
by market, currency, and route, so locale differences must not be normalized
away.

### 2. Install the isolated fetcher

Playwright is isolated in `ops/fetch` so the production application does not
install a browser dependency.

```bash
cd ops/fetch
yarn install
npx playwright install chromium
cd ../..
```

### 3. Run URL preflight

Preflight detects invalid URLs, unrelated redirects, home-page fallbacks, and
several page keys collapsing onto one destination before a full browser fetch.

```bash
yarn preflight
yarn preflight --carrier qantas
```

Review preflight findings rather than automatically rewriting source URLs.

### 4. Fetch and archive source pages

```bash
yarn fetch
yarn fetch --carrier qantas
yarn fetch --dry-run
```

The fetcher archives HTML and metadata under:

```text
data/captures/<YYYY-MM-DD>/<carrier_key>/<page_key>.html
data/captures/<YYYY-MM-DD>/<carrier_key>/<page_key>.meta.json
```

Fetching is deliberately separate from extraction. Source sites are contacted
once, after which extraction can be improved offline without repeatedly
requesting the airline's site.

The fetcher:

- obeys `robots.txt` and fails closed when it cannot read it;
- identifies itself through its user agent;
- runs serially and respects a per-host delay;
- rejects non-essential consent when possible;
- never accepts tracking merely to obtain content;
- does not use proxies or bypass CAPTCHAs and bot detection;
- records blocks and locale redirects as explicit statuses; and
- never replaces a previously successful body with a failed recapture.

Blocked sources enter a manual-capture queue. They are not treated as permission
to bypass access controls.

### 5. Discover and approve article selectors

Whole-page text is unsafe because navigation, country selectors, and promotional
components often contain weights, dimensions, durations, and currencies. Each
carrier therefore needs a reviewed article-body selector.

Generate selector recommendations from archived pages:

```bash
yarn selectors:discover
yarn selectors:discover --carrier american-airlines --date 2026-08-24
```

Recommendations are written under `data/proposals/` and never modify
`ops/fetch/selectors.json` automatically. Review coverage across every usable
page before adding a selector to the approved configuration.

### 6. Extract measurement candidates offline

Extract one carrier:

```bash
yarn extract --carrier american-airlines --date 2026-08-24
```

Extract several approved carriers:

```bash
yarn extract:batch --carriers american-airlines,frontier,ryanair --date 2026-08-24
```

Extraction identifies dimensions, weights, counts, money, and durations inside
the approved article container. Every candidate retains:

- the raw measurement;
- its evidence sentence;
- page key; and
- official source URL.

The extractor does not decide whether `23 kg` is included baggage, a purchased
tier, an excess limit, or a cabin allowance. That decision belongs to the
interpretation and review stages.

### 7. Generate non-destructive drafts

```bash
yarn draft --carrier finnair
yarn draft:batch --carriers air-canada,american-airlines,finnair
```

Drafts are written to `data/proposals/airline-facts/`. If a published fact file
already exists, it is detected and left unchanged. The proposal is labelled
`review_and_merge`; a carrier without a file is labelled `review_and_create`.

Never restore the old behavior of writing a generated draft directly over
`content/airline-facts/<slug>.json`.

### 8. Interpret candidates conservatively

```bash
yarn interpret --carrier frontier
yarn interpret:batch --carriers air-canada,american-airlines,finnair,frontier
```

The deterministic interpreter proposes field meanings only when explicit
context exists. It records confidence, rationale, flags, evidence, and source.
It also:

- flags multiple contextual values instead of calling them universal rules;
- lowers confidence when one sentence mixes multiple bag types;
- flags implausible weights, dimensions, or durations;
- sends route-, fare-, and timing-dependent fees to review; and
- leaves unclassified candidates untouched rather than guessing.

High confidence is intentionally rare. Confidence is a review-prioritization
signal, not permission to publish.

### 9. Build the review report and preview facts

```bash
yarn review:build
```

This produces:

- `data/proposals/review.html` for local review;
- `data/proposals/review-manifest.json` for the online preview; and
- `data/proposals/preview-facts/<carrier>.json` containing pending-only preview
  fields.

Local review:

```text
data/proposals/review.html
```

Online review route:

```text
/preview/airline-facts-review
```

The online route is read-only and `noindex, nofollow, nocache`. It cannot approve
or publish fields.

### 10. Human review and approval

For every proposed field, confirm:

- the sentence describes the proposed product and not a neighboring heading;
- market, route, fare, cabin, and purchase timing are preserved;
- imperial and metric values are equivalent rather than different limits;
- the source URL is official and opens to the relevant content;
- duplicate captures are not being mistaken for independent agreement;
- a fee includes its currency and conditions; and
- the proposed field does not overwrite a different existing official fact.

Approval should create a small, explicit field-level patch. Do not bulk-copy the
preview fact file into the published store.

### 11. Prove citations and validate

After a reviewer has assigned the correct field meaning, the promotion tool can
prove that measurements occur in the captured official article:

```bash
yarn promote --carrier ryanair --dry-run
yarn promote --carrier ryanair
yarn promote --carrier ryanair --recheck
```

The tool verifies provenance; it does not decide semantics. Prose-only claims
remain manual because substring matching cannot prove what prose means.

Then run:

```bash
yarn validate:facts
yarn build
```

### 12. Preview QA

Review the airline template before changing the live route:

```text
/preview/airlines/<slug>
```

Check:

- heading hierarchy and SEO title;
- jump links and sidebar behavior;
- mobile layout and table overflow;
- collapsed disclosure for long content;
- source links and verification labels;
- unpublished and disputed states;
- contact details and small print;
- structured data; and
- `noindex` metadata on every preview route.

### 13. Publish gradually

Publication should be carrier-by-carrier or module-by-module, with small commits.
Do not publish all 75 carriers in one generated change.

For each publication:

1. inspect the field-level diff;
2. validate the fact store;
3. run the production build;
4. review the preview route;
5. merge the approved commit to `main`;
6. deploy through the project's controlled deployment process; and
7. verify the public route, canonical URL, robots metadata, and source links.

Pushing a feature branch is not publication. The change is shipped only when
its patch is reachable from `origin/main` and the deployed site has been
verified.

## Capture statuses and operator response

| Status | Meaning | Next action |
|---|---|---|
| `ok` | Plausible content archived | Extract offline |
| `robots_denied` | Path disallowed | Do not fetch; find an allowed official source |
| `robots_unavailable` | Robots could not be read | Retry later; do not assume permission |
| `blocked` | Access control, CAPTCHA, or HTTP 403 | Manual capture or alternate official source |
| `redirected_locale` | Locale-shaped URL changed | Review market and URL manually |
| `too_short` | Consent shell or incomplete content | Inspect manually |
| `soft_404` | HTTP 200 but wrong document | Correct the configured URL |
| `error` | Network or non-200 failure | Retry or queue for manual review |

## Quarterly refresh automation

A scheduled refresh may automate:

- preflight and archival capture;
- content-hash change detection;
- extraction for approved selectors;
- non-destructive proposals;
- conservative interpretation;
- conflict and plausibility reports; and
- regeneration of the review dashboard.

It must not automate:

- CAPTCHA or bot-detection bypass;
- semantic approval of ambiguous fare and baggage rules;
- replacement of an existing official field;
- changing `pending` to `official` without citation proof; or
- production publication without an explicit reviewed patch.

The recommended recurring sequence is:

```text
fetch changed sources -> extract -> interpret -> build review -> editorial review
-> citation proof -> validation -> preview QA -> controlled publish
```

## Current implementation state

At the time this guide was written:

- all 75 configured carriers had completed an archival fetch attempt;
- selector recommendations were available for the carriers with usable pages;
- ten carriers had batch candidate extraction and non-destructive proposals;
- deterministic interpretation generated reviewable field proposals;
- the review report used collapsed airline and module accordions; and
- no automated proposal was authorized to publish directly to the fact store.

This state will evolve. The invariants above—official provenance, conservative
interpretation, explicit approval, validation, and preview isolation—must remain.
