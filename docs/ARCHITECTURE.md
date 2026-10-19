# Architecture

Next.js 16 (App Router), React 19, Tailwind CSS 4, Motion, Zod, Vitest. The site is exported as static files for GitHub Pages; `npm run dev` runs it as a normal Next.js app.

## Code layout

```
app/                     routes
  page.tsx               sheet 1: timeline map
  era/[eraId]/           sheet 2: suit × grade kit grid (one static page per era)
  era/layout.tsx         persistent era rail + kit drawer host
  kit/[skuId]/           sheet 3 as a full page (direct links)
  kit-data/[skuId]/      per-kit JSON loaded by the drawer
  api/search/            search index (static JSON)
  credits/, data/catalog.json/   attribution page and catalog download
components/
  timeline/              StrandMap (SVG map), MetroList (mobile), EraRail
  matrix/                EraView (controls), GradeGrid, TimelineLens, KitTile, model.ts (filters)
  drawer/                KitDrawerHost (?kit= → fetch), KitDrawer (panel), KitDetailView, RetailerLinks
lib/
  schema.ts              Zod schemas for every record
  ingested.ts            builds the app dataset from data/generated/catalog.json
  data.ts                validated dataset + referential-integrity checks
  repo.ts                read-side selectors (era matrix, kit detail, search index)
  layout/strands.ts      map geometry
data/
  timelines.ts, suits.ts hand-curated structure: timelines, stations, works, variant links
  generated/             catalog.json and ingest-report.md (pipeline output, committed)
scripts/
  ingest/                the ingestion pipeline (see below)
  validate-data.ts       schema + integrity + JAN provenance audit
tests/                   Vitest
```

## Data model

```
TimelineNode → Era (station) → Work
MobileSuit  (discovered from Gundam Wiki; debutEraId places it on a station)
Mold        (one kit design; sourced specs: materials, glue, paint)
KitSKU      (one retail release: name, date, list price, JAN, Bandai item code, edition)
SourceRef   (page title, URL, revision, license, fetch date) attached to every sourced value
```

- `KitSKU.id` is the kit key: `bandai-<item code>`, else `jan-<JAN>`, else a stable ID derived from the source row.
- `Provenance.fields` names exactly which values a record's citations back. Values not listed there are absent, not guessed.
- The only hand-curated data is structural: the timelines and stations (`data/timelines.ts`) and editorial variant links between suits (`data/suits.ts`). No kit fact is hand-entered.

## Ingestion pipeline (`scripts/ingest/`)

| File | Role |
|---|---|
| `http.ts` | Polite cached fetch (1 req/s, honest User-Agent); snapshots under `data/sources/cache/` (not committed) |
| `wikitext.ts` | MediaWiki table parser (headers, row/col spans, multi-line cells) |
| `sources.ts` | The ~60 Gundam Wiki and Japanese Wikipedia pages read, one per Gunpla line |
| `merch.ts` | Parser for the `{{merch}}` template some list pages use (JAN, manual ID) |
| `discover.ts` | Suit discovery from mobile-suit infoboxes: timeline, debut year → station, operator → faction |
| `gunplawiki.ts` | Gunpla Wiki per-kit infoboxes: JAN, exact date, materials, glue, paint |
| `fyi.ts` | gunpla.fyi product index (item codes). Its JSON is decoded as text; nothing from the site is executed |
| `normalize.ts` | Dates, yen, version labels, editions, model numbers |
| `index.ts` | Orchestration: collect rows → discover suits → merge sources → de-duplicate → write catalog + report |

Merges between sources happen only on exact evidence (line number, Bandai manual ID, or a unique same-month release). Anything ambiguous is kept as its own record and listed in the report.

`validate-data.ts` re-opens the cached source page cited for every JAN and fails if the JAN isn't on it. CI runs it before every deploy and every weekly data commit.

## Static-site design

- `PAGES_EXPORT=1` switches `next.config.ts` to `output: "export"` with the `/gunpla-universe` base path.
- Every era and kit page is pre-rendered (`generateStaticParams`), about 390 MB in total.
- The kit drawer opens from `?kit=<key>` and loads the pre-rendered `/kit-data/<key>` file, so it works without a server, and drawer URLs can be shared.
- To keep pages small, era grids ship slimmed tile records, and the kit page's lineage strip shows the 40 kits nearest the current one.
