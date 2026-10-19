# Gunpla Universe

**Live site:** https://adariumesh.github.io/gunpla-universe/

A visual guide to every Gundam timeline and the Gunpla model kits Bandai has released for each mobile suit. You start at a transit-map of the timelines, open an era to see its suits against every kit grade, and open a kit to see its sourced facts and where to buy it.

Every value in the catalog comes from a cited open source. Nothing is estimated or hand-typed, and missing facts are shown as missing.

## What's in it

| | |
|---|---|
| Timelines | 13 (UC, FC, AC, AW, AG, AD 00, CE, PD, AS, RC, CC, Build, SD World), 39 stations, all open |
| Mobile suits | 1,028, discovered from Gundam Wiki; 93% placed by the series their kits come from |
| Kits | 3,380 (2,013 standard releases, the rest recolors and limited editions) |
| Release date | 100% of kits (25% to the exact day) |
| Bandai list price | 91% |
| JAN barcode | 779 kits (23%), every one checked against its source page |
| Bandai item code | 736 kits (22%), with a link to the official instruction manual |
| Materials / glue (incl. ABS warnings) | 27% |

## The three sheets

1. **Map** (`/`): the timelines drawn as transit lines; each station is an era.
2. **Kit grid** (`/era/<era>/`): suits (columns, grouped by faction) × grades (rows). Each cell stacks every release of that suit in that grade, and empty cells say "never kitted". A release-timeline lens shows the same kits by year.
3. **Kit detail** (drawer, `?kit=<key>`, or `/kit/<key>/`): identity, sourced specs, every kit of the same suit, retailer search links, and citations.

Search (⌘K) covers suits and kits, including by item code and JAN.

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev              # http://localhost:3000
npm test                 # 28 tests
npm run validate:data    # schema, integrity, JAN provenance audit
npm run build:pages      # static site in out/, as deployed
```

## How the data is built

`npm run ingest` builds `data/generated/catalog.json` from four sources and writes `data/generated/ingest-report.md` (coverage, conflicts and gaps). Pass `-- --refresh` to re-fetch everything (about 1 request per second, honest User-Agent); otherwise it re-parses cached snapshots.

| Source | Provides | License |
|---|---|---|
| [Gundam Wiki](https://gundam.fandom.com): list pages for every Gunpla line | kit rows: line number, release month, list price, edition | CC BY-SA 3.0 |
| Gundam Wiki suit pages | timeline, in-universe debut (→ station), faction, pilot | CC BY-SA 3.0 |
| [Gunpla Wiki](https://gunpla.fandom.com): one page per kit | JAN, exact release date, materials, glue, paint | CC BY-SA |
| Japanese Wikipedia | independent cross-check of release months | CC BY-SA 4.0 |
| [gunpla.fyi](https://gunpla.fyi) (index of Bandai's manual site) | Bandai item code, official name, manual link | factual data, attributed |

**Integrity rules:**
- A JAN is accepted only when a source page states it and it passes the EAN-13 check digit.
- Records from different sources are merged only on an unambiguous match (same suit and grade, plus the same line number, the same manual ID, or the only release that month). Uncertain records stay separate.
- A JAN published for two different kits is marked *disputed* and kept out (25 today; listed in the report).
- Kits are keyed by **Bandai item code**, then **JAN**, then a stable source-derived ID.
- Suits are placed on the station of the **series** most of their kits come from (`data/series.ts`), using the in-universe debut year only to choose within multi-station series or when no series is known. Suits with neither are marked *undated* rather than guessed (12 today).
- Sites that refuse automated access (Bandai Hobby, HobbySearch, Surugaya, Modelverse, Reddit) are never scraped. They appear only as links.

## Deployment

GitHub Actions (`.github/workflows/`):
- `deploy.yml`: on every push to `main`, validates the data, runs the tests, builds the static site and deploys it to GitHub Pages.
- `refresh.yml`: every Monday, re-fetches all sources and commits the new catalog **only if** the JAN audit and tests pass, then redeploys.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): code layout, data model, ingestion pipeline, static-site design
- [docs/REVIEW.md](docs/REVIEW.md): project status, known limitations, decisions and open questions for reviewers
- [docs/reddit-plan.md](docs/reddit-plan.md): options for adding community build knowledge
- `data/generated/ingest-report.md`: output of the latest data run

## License

- Code: [MIT](LICENSE).
- Data (`data/generated/`, and the catalog download at `/data/catalog.json`): derived from CC BY-SA sources, so it is released under [CC BY-SA 4.0](DATA_LICENSE.md) with attribution to those sources.
- Gundam, Gunpla and related names are trademarks of Sotsu, Sunrise and BANDAI SPIRITS. This is an unofficial fan project, not affiliated with them or with any source listed above.
