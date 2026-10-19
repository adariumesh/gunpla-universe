# Review brief

**Live site:** https://adariumesh.github.io/gunpla-universe/ · **Repo:** https://github.com/adariumesh/gunpla-universe

## What this is

A three-sheet guide to Gunpla. Sheet 1 is a timeline map, sheet 2 is an era's suits × kit grades, and sheet 3 is one kit's facts. It is built entirely from cited open data: the core rule is that **nothing is estimated or hand-typed**. If no source states a value, the site shows it as missing.

## Status

| Area | State |
|---|---|
| Site | Live on GitHub Pages; redeploys on every push to `main` |
| Data refresh | Weekly GitHub Action; ships new data only if the JAN audit and tests pass |
| Coverage | 1,028 suits, 3,380 kits, 13 timelines, all 39 stations open |
| Facts per kit | release date 100% · list price 91% · materials/glue 27% · JAN 23% · Bandai item code 22% |
| Checks | 28 tests; schema, integrity and JAN provenance audit (`npm run validate:data`) |

## Decisions worth reviewing

1. **No estimated values.** An earlier prototype showed stability, articulation, part counts, build time and USD price brackets. These were removed because no source states them per kit.
2. **JAN integrity over coverage.** A JAN is accepted only when a source page states it, it passes the check digit, and it matches a kit unambiguously. 25 JANs that sources attach to two different kits are held back as *disputed*.
3. **Kit key.** Bandai item code, then JAN, then a source-derived ID. The item code is preferred because it is printed on every box and doesn't change across reissues.
4. **Only sources that permit automated access.** Bandai Hobby, HobbySearch and Surugaya block bots; Modelverse's terms forbid scraping; Reddit disallows crawling. These appear only as links. Modelverse has been asked for permission to use its catalog (awaiting a reply).
5. **Placement by series, not by date.** Wiki infobox dates are often when a suit was *built* (Mk-II: 0086, F91: 0116), not when its story is set. Suits are placed by the series their kits come from, which also covers stations the original infographic lacked (UC 0085 GQuuuuuuX, UC 0111 Formula, UC 0133 Crossbone, AD 2312, CE 75, AG 141/164, PD 325, AS 122, SD World).
6. **Static hosting.** Every page is pre-rendered (~390 MB) so the site needs no server and costs nothing to host.

## Known limitations

- **JAN coverage is 23%.** No other free source permits automated collection. Next options: a feed from Modelverse (requested), or paid/registered retailer APIs (declined for now: they need accounts).
- **No images.** Box art and anime artwork are Bandai/Sunrise copyright. Wikimedia Commons has only a few dozen freely licensed Gundam photos (mostly the life-size statues), so tiles show schematic plates.
- **No build-quality information.** Community knowledge (loose joints, "hand grenade" kits) would need Reddit's API and account; see [reddit-plan.md](reddit-plan.md).
- **12 undated suits** have neither series data nor a debut date; they are flagged *undated* in the grid, and 7 suit pages belong to universes not on the map (e.g. Extreme Vs., After Apocalypse). Both lists are in the ingest report.
- **Heuristic classifications.** Edition (standard / limited / recolor) comes from keywords in source names and sections. Faction is the first unqualified operator in the suit's wiki infobox. Both are occasionally wrong.
- **Unmatched rows.** 459 source rows didn't resolve to a mobile suit (mostly ships, vehicles, non-Gundam kits); they're listed in `data/generated/ingest-report.md`.
- **Thin stations** reflect real kit scarcity, e.g. UC 0097 and UC 0223.
- **Not yet done:** an accessibility audit, end-to-end browser tests, and performance budgets in CI.

## Questions for reviewers

1. Is the three-sheet navigation (map → grid → kit) clear without explanation?
2. Is showing "not published by any source yet" preferable to hiding missing fields?
3. Which matters more next: JAN coverage, images, or community build knowledge?
4. Any concerns with the data licensing (code MIT, data CC BY-SA 4.0) or the attribution on `/credits`?

## How to check the claims

```bash
npm install
npm run validate:data   # re-checks every JAN against its cited source page
npm test
```

`data/generated/ingest-report.md` lists every source page used, coverage by station, merges, disputes and unmatched rows.
