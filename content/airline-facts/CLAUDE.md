# Originfacts — airline reference pages

Next.js 15 (App Router) site at www.originfacts.com. This file governs the
airline reference pages under `/airlines/<slug>` and the fact files behind them.

## What these pages are

Reference pages for ~75 Tier 1 carriers: baggage, fares, cabins, check-in,
passenger rights, contact. Their entire value is that every printed figure is
traceable to a source a reader can open. The differentiator is not coverage or
prose — it is provenance.

Remaining carriers stay as thin directory entries, `noindex`, out of the sitemap.

## Non-negotiable data rules

These exist because each one has already been violated once. Do not relax them
without me saying so explicitly in the session.

1. **A failed lookup writes `null` and status `pending`.**
   Never a default that reads like an answer. `alliance: "none"` was written for
   all 75 carriers because a missing Wikidata property became a positive claim.
   Empty is honest; a plausible-looking wrong value is not.

2. **Never widen precision.**
   A year stays a year. Do not pad `1985` to `1985-01-01`. If the source gives a
   year, the field holds a year and the format says so.

3. **Every published value carries `source_url` and `verified_at`.**
   No exceptions. No inheriting a stamp from a sibling field, a previous run, or
   another carrier. If you cannot name the URL it came from, it is not verified.

4. **Where sources conflict, store both and publish neither.**
   Set status `disputed`, record both values in `notes`, render the conflict on
   the page. Do not pick the more common one.

5. **The entity must match.**
   `founded` means this airline, not a predecessor. British Airways was formed in
   1974, not 1919. Lufthansa dates to 1953, not 1926. When a source describes a
   predecessor company, that is a different entity — leave the field pending.

6. **Do not edit a field with status `official` without a new source URL and a
   new verification date.** Changing the value while keeping the old stamp is
   worse than leaving it stale.

## Status vocabulary

| Status | Meaning | Renders? |
|---|---|---|
| `official` | From the carrier's own published page or a named regulator | Yes |
| `third_party` | Aggregator, encyclopedia, blog. Plausible, unconfirmed | No |
| `disputed` | Credible sources disagree | No — render the conflict |
| `pending` | Not yet researched, or lookup failed | No |
| `n/a` | Does not apply to this carrier | No |

Only `official` publishes. A module renders only when every required field in it
is `official`; otherwise it renders the unpublished empty state.

## Layout

- `content/airline-facts/<slug>.json` — the fact files. Source of truth for the pages.
- <!-- fill in: page component path -->
- <!-- fill in: schema / validation path -->
- <!-- fill in: pipeline / scripts path -->

## Commands

<!-- fill these in — Claude should use these rather than guessing -->
- Build: `npm run build`
- Validate fact files: `<command>`
- Dev server: `npm run dev`
- Deploy: manual and deliberate. Do not run it.

## Existing verified data sources

Do not re-derive these; read what is already stored.

- **Duffel Airlines API** (`api.duffel.com/air/airlines`) — carrier identity.
- **Originfacts route-network dataset**, from TravelPayouts — routes,
  destinations, airports by route count, sector distances, aircraft types seen.
  This accumulates over time. It is **not** a fleet register: it names retired
  types and misses recent additions. Never present it as a current fleet.
- **Carrier conditions of carriage** — the only acceptable source for baggage,
  carry-on, fares and check-in.
- **Regulators** — infrastructure.gov.au, EUR-Lex, UK CAA — for passenger rights.

## Known issues

- **ICAO codes are wrong.** Qantas renders as `EAQ`; the correct code is `QFA`.
  Whatever join produced this affects all carriers. Fix the source, then backfill
  from OurAirports (public domain) or Wikidata (CC0). Do not hand-type 75 codes.
- **The ledger header shows "Last full review 6 Dec 2023"** — the newest review
  date is leaking into it. It should reflect the most recent field verification.
- **The reviews module** publishes an aggregate score from reviews no newer than
  Dec 2023. Treat as under review; do not extend it until sourcing is settled.

## Working style

- **Plan first for anything touching `content/airline-facts/`.** I want to read
  the diff before you write 75 files.
- Small commits, one concern each. A schema change and a data backfill are two
  commits.
- When a source page is ambiguous, stop and ask. Do not resolve ambiguity by
  choosing — that is how wrong values get stamped `official`.
- Prefer deterministic scripts over agentic loops for anything that runs
  quarterly. The refresh must produce a clean diff against the previous run.
- Do not bypass bot detection or CAPTCHAs on carrier sites. Where a page blocks
  automated access, flag the carrier for manual capture.

## What good looks like

A field nobody has verified renders as an honest empty state. A field that
conflicts renders as a stated conflict. A field that publishes carries a date and
a link. Fewer published fields, all correct, beats a full page of plausible
numbers — the page is worth reading precisely because we say what we do not know.