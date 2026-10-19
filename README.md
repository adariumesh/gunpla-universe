# Gunpla Universe

A three-level Gundam timeline and Gunpla kit discovery tool.

1. **L1 · Timeline transit** (`/`): the infographic redrawn as an interactive strand map. Clicking a UC 0079–0093 station "straightens" its strand into the era rail. Below 768px it becomes a vertical metro list.
2. **L2 · Suit × kit matrix** (`/era/[eraId]`): suits are columns grouped by faction, and grades are rows. Cells are **stacks** of releases (newest mold on top), and an empty cell is a ghost that says "never kitted". It has two lenses (Grade grid / Release timeline) that morph into each other. Low-weight variants (G-3, The Origin) are collapsed under their parent, and the persistent era rail lets you jump between eras without going back to the map.
3. **L3 · Kit inspection** (`/kit/[skuId]`): a drawer over the matrix, using an intercepting route, or a full page when deep-linked or refreshed. It covers identity and MSRP history, engineering meters, build profile, lineage with side-by-side compare, frame family, a stock "telemetry" panel (mock adapters), and provenance.

The design spec this implements lives in the plan file from the planning session. In short: drafting canvas for structure, bridge-terminal (HUD) for accents. Light mode is "Vellum" and dark mode is "HUD".

## Run

Node lives at `~/.local/node` (installed locally, no sudo). Put it on your PATH first:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

```bash
npm run dev            # http://localhost:3000
npm test               # selector tests (vitest)
npm run validate:data  # zod schema + referential integrity
npm run build
```

## Layout

```
data/        seed modules: timelines/eras/works, suits + appearances, kits (molds + SKUs)
lib/         schema.ts (zod), data.ts (parse + integrity), repo.ts (selectors), stock.ts (RetailerAdapter), layout/strands.ts (L1 geometry)
components/  timeline/ (StrandMap, MetroList, EraRail) · matrix/ (EraView, GradeGrid, TimelineLens, KitTile) · drawer/ (KitDrawer, KitDetailView, StockPanel)
app/         routes; @drawer is the parallel slot that hosts the intercepted kit drawer
```

**Key model decision:** engineering facts live on the **Mold**, while JAN, price and stock live on each **KitSKU**. Reissues and limited editions are extra SKUs of the same mold. A variant suit (G-3, Char's Zaku) is its own `MobileSuit` with `variantOf`, and a recolor of the same plastic is a SKU edition.

## Data: open-source ingestion (every timeline)

The catalog is built from open sources by `npm run ingest`; nothing in it is hand-typed.

```bash
npm run ingest              # re-parse cached snapshots → data/generated/catalog.json
npm run ingest -- --refresh # re-fetch from the sources (~1 req/s, honest User-Agent)
npm run validate:data       # schema, integrity, and the JAN provenance audit
```

| Source | What it provides | License |
|---|---|---|
| [Gundam Wiki](https://gundam.fandom.com) list pages for every Gunpla line (≈60 pages) | kit rows: line no., release month, yen, edition | CC BY-SA 3.0 |
| Gundam Wiki suit pages (infobox) | **suit discovery**: timeline (`era`), in-universe debut → transit station, operator, pilot | CC BY-SA 3.0 |
| [Gunpla Wiki](https://gunpla.fandom.com) kit pages (`Plamo Infobox`) | **JAN**, exact release date, materials (ABS/KPS), glue, paint | CC BY-SA |
| Japanese Wikipedia grade articles | corroborates release months by line number | CC BY-SA 4.0 |
| [gunpla.fyi](https://gunpla.fyi) product index (from Bandai's manual site) | Bandai item code, official names, manual link | factual data, attributed |

Not scraped, because they reject automated clients: bandai-hobby.net, HobbySearch, Surugaya.

### JAN is the primary key, and nothing is fabricated

- JANs come **only** from a Gunpla Wiki kit page that publishes one. Each must pass the EAN-13 check digit and carry a Bandai/Japanese prefix.
- A kit page is merged into a list-table release only on an **unambiguous** match: the same suit and grade, plus the same lineup number or the only release that month. Anything uncertain stays a standalone, JAN-keyed record.
- A JAN published on two different kit pages is **disputed**. It is kept out of the dataset and listed in the report.
- `catalog.json → jans` is the key table. Every JAN is there, including ones without a resolvable suit or date.
- `validate:data` re-checks every shipped JAN against the exact cached source page it cites.
- **Nothing is estimated.** Per-kit build scores (stability, articulation, part counts, build time), the USD bracket and the mock stock panel were removed. Specs show only what Gunpla Wiki states (materials, glue, paint), and missing values are shown as missing.
- **Kit key**: `bandai-<item code>` when gunpla.fyi supplies Bandai's item code, else `jan-<JAN>`, else a stable source-derived ID.
- **Suits**: facts (name, faction = first unqualified infobox operator, pilot, debut station) come from Gundam Wiki. `data/suits.ts` only adds editorial variant links and ordering.
- **Where to buy**: plain retailer search links (HobbySearch, HLJ, Amazon, eBay) plus an r/Gunpla search link. No retailer or Reddit data is collected.
- **Credits**: `/credits` lists sources and licenses. The derived catalog is downloadable at `/data/catalog.json` (CC BY-SA).
- **Community build knowledge**: see `docs/reddit-plan.md`. Reddit disallows crawling, so this needs a Reddit account and the official API.

Read `data/generated/ingest-report.md` after each run for:
- coverage by station
- per-page parse stats
- seed corrections
- disputed JANs
- unplaced suits
- unmatched rows

## Deviations from the spec

- **Next 16** instead of 15 (current release).
- **No D3.** Every strand runs at 45°, so the geometry is simple arithmetic.
- **No column virtualization yet.** UC 0079 has 189 columns and loads in about 0.3 s in production (98 KB gzipped). Tiles are slimmed for the matrix, and big eras skip the entrance animation. Virtualize if eras grow much further.
- **Typed TS seed modules instead of JSON**, still validated with zod at load and by `validate:data`.
