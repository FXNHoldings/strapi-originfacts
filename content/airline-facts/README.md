# Airline fact store

One file per airline: `content/airline-facts/<slug>.json`, where `<slug>` matches
the airline slug in Strapi (the same one `/airlines/<slug>` uses).

This is the store the Tier 1 template reads. Loader: `lib/airline-facts.ts`.

## The rule this store exists to enforce

**A module with no sources does not render.** There is no fallback prose. If a
figure has not been verified against a citable source, the module shows as
*Unpublished* on the page instead — a visible gap, not a plausible-looking
paragraph with nothing behind it.

The loader drops any module missing `id`, `title`, `verifiedAt`, or a non-empty
`sources` array, so a half-filled spreadsheet row cannot reach the page by
accident.

## Shape

```jsonc
{
  "slug": "qantas",
  "modules": [
    {
      "id": "baggage",              // baggage | carryon | fares | rights | checkin
      "title": "Checked baggage",
      "status": "verified",         // "verified" | "disputed"
      "verifiedAt": "2026-08-24",   // YYYY-MM-DD — drives the module stamp
      "statusNote": "…",            // shown instead of the date when disputed
      "lede": "One-sentence opener.",
      "body": ["Paragraph.", "Paragraph."],
      "table": {
        "caption": "Included checked allowance by route and cabin",
        "columns": ["Cabin", "Domestic", "International"],
        "rows": [["Economy", "1 × 23 kg", "30 kg total"]]   // cell 0 is the row header
      },
      "rule":     { "key": "32 kg", "text": "One limit that cuts across every row." },
      "conflicts": [{ "title": "Sources disagree", "text": "Say so; print neither number." }],
      "sources":  [{ "label": "Qantas, Checked baggage", "url": "https://…", "note": "primary" }],
      "reviewNote": "Next review Nov 2026"
    }
  ]
}
```

Every field except `id`, `title`, `status`, `verifiedAt` and `sources` is
optional — a module that is only a table and a source is perfectly valid.

## Module ids the template lays out

| id        | Module                                | Comes from  |
|-----------|---------------------------------------|-------------|
| `baggage` | Checked baggage                       | this store  |
| `carryon` | Carry-on                              | this store  |
| `fares`   | What the cheapest fare includes       | this store  |
| `cabins`  | Cabins and seating                    | route data  |
| `rights`  | If your flight is delayed or cancelled| this store  |
| `checkin` | Check-in and airport cutoffs          | this store  |
| `network` | Where they fly                        | route data  |
| `faq`     | Common questions                      | route data  |

`cabins`, `network` and `faq` are built from the route-network dataset in
`data/route-facts/` and cite it by name and `updated` stamp. Entries for those
ids in a fact file are ignored.

## Conventions

- **`verifiedAt` is per module, not per page.** A module's stamp is its own
  oldest fact. The page-level "last full review" in the ledger is the oldest
  date across the modules that published.
- **Cite the carrier, not an aggregator.** The source of record for an
  allowance is the airline's own conditions of carriage. Duffel's
  `conditions_of_carriage_url` gives that link for 57 of the 71 Tier 1 carriers.
- **When sources disagree, use `conflicts` and print neither number.** A module
  that silently picks one of two figures has guessed, and the reader has no way
  to tell.
- **Dimensions and weights carry their units in the cell** (`"1 × 23 kg"`,
  `"140 cm total"`). The template does not add units or convert between them.

## Sample file

`_sample.qantas.json` holds the content from the design mock so the template can
be reviewed with populated modules. **Its figures are not verified.** It loads
only behind `/preview/airlines/qantas?sample=1`, never on a live page, and the
leading underscore keeps it from colliding with a real slug. Delete it once real
data lands.
