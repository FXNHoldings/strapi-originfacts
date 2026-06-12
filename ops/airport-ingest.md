# Airport data ingest (Phase 2 — AdSense enrichment)

`scripts/ingest-airport-info.mjs` enriches the Strapi **Airports** collection
from the RapidAPI **airport-info** API, so each `/airports/<iata>` page carries
real facts and a written `about`. A populated `about` also flips a previously
thin airport past the Phase‑1 index quality gate (`lib/entity-seo`), so it
becomes indexable in Google.

It only **fills empty fields** (`icao`, `city`, `country`, `countryCode`,
`latitude`, `longitude`, and `timezone` when missing) and writes a factual
`about` when the airport has none. It never overwrites existing curated data.

## 1. Create a Strapi write token (one-time)

In Strapi admin → **Settings → API Tokens → Create new API Token**:

- Name: `airport-ingest`
- Token type: **Custom**
- Permissions: **Airport → `update`** (and `find` if not public)
- Duration: 7 days (or as you like)

Copy the token — it's shown once.

> Rotate the RapidAPI key that was shared in chat; treat both as secrets and
> pass them via env only (never commit them).

## 2. Dry-run first (no writes)

```bash
cd /var/www/html/originfacts.com
RAPIDAPI_KEY=*** node scripts/ingest-airport-info.mjs --only SYD,LHR,YBL
```

You'll see, per airport, which fields it *would* set and a preview of the
generated `about`. Nothing is written without `--write`.

## 3. Write for real (throttled, resumable)

```bash
RAPIDAPI_KEY=*** \
STRAPI_WRITE_TOKEN=*** \
node scripts/ingest-airport-info.mjs --write --sleep 2000 --limit 400
```

- **Default targets "needy" airports** (missing `about`, geo, or `icao`) — by
  default airports that already have an `about` are skipped.
- **Checkpointed:** progress is saved to `scripts/.airport-ingest-progress.json`
  after every airport. Re-running resumes where it left off — so split the
  ~3,600 airports across several runs/days to stay under the free-tier quota.
- On repeated HTTP 429 it backs off and stops cleanly; just run it again later.

### Flags

| flag | effect |
|------|--------|
| `--write` | persist to Strapi (default: dry-run) |
| `--limit N` | process at most N this run (quota control) |
| `--only AAA,BBB` | only these IATA codes |
| `--sleep MS` | delay between API calls (default 1500) |
| `--force` | rewrite `about` even if one exists |
| `--all` | process every airport, not just needy ones |
| `--fresh` | ignore the resume checkpoint and start over |

## 4. After ingest

Strapi pages are ISR (`revalidate = 60`), so updates appear within ~a minute.
The next `sitemap.xml` regeneration (hourly) will start including the newly
substantive airports. Re-submit the sitemap in Google Search Console once a
batch is done.

> Rate limits: the free RapidAPI tier is typically a few hundred calls/day.
> With `--limit` + the resume checkpoint, run it daily until coverage is
> complete. A paid tier removes the need to spread it out.

## Notes / future

- The API does not return elevation or runways; `about` is built from name,
  location, IATA/ICAO, coordinates, time zone, postal area, phone and website.
- An optional later pass could add AI-written prose (data-grounded) on top of
  these fields for the highest-traffic airports.
- The same pattern can be repeated for **airlines** against a carrier dataset.
