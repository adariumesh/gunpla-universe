/*
 * Open-data ingestion for every Gundam timeline.
 *
 *   1. Kit list tables from every Gunpla line page on Gundam Wiki   (CC BY-SA)
 *      … and the {{merch}} entries some of those pages use instead (JAN, manual id)
 *   2. Suit discovery: each kit row links its suit page; the page's infobox
 *      gives timeline, in-universe debut, operator and pilot → transit station
 *   3. Japanese Wikipedia corroborates release months by line number (CC BY-SA)
 *   4. gunpla.fyi product index (from Bandai's manual site) adds Bandai item
 *      codes, exact release days and official names
 *   5. De-duplicate records that describe the same product (exact evidence only)
 *
 *   npm run ingest              # offline: re-parse cached snapshots
 *   npm run ingest -- --refresh # re-fetch (~1 req/s, honest User-Agent)
 *
 * Outputs (committed): data/generated/catalog.json, data/generated/ingest-report.md
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { suits as curatedSuits } from "../../data/suits";
import { eras } from "../../data/timelines";
import { Catalog, type DiscoveredSuit, type Era, type IngestedRelease, type JanRecord, type SourceRef, type TimelineId } from "../../lib/schema";
import { debutYear, fetchInfoboxes, infoboxRef, stationFor, timelineOf, type Infobox } from "./discover";
import { fyiGrade, jaccard, loadFyi, nameTokens, type FyiProduct } from "./fyi";
import { loadKitPages, type KitPage } from "./gunplawiki";
import type { MerchRow } from "./merch";
import { classifyEdition, modelTokens, normModel, parseReleaseDate, parseVersion, parseYen } from "./normalize";
import { GUNDAM_WIKI_PAGES, JA_WIKIPEDIA_PAGES, columnMap, loadPage, type Page } from "./sources";
import type { Cell } from "./wikitext";

const refresh = process.argv.includes("--refresh");
const OUT = join(process.cwd(), "data", "generated");

// Accessory/option products listed alongside kits on the grade pages.
const NOT_A_KIT =
  /\bparts\b|parts set|conversion|weapon set|custom set|decal|action base|display base|expansion|effect|color body|body for|option|lighting unit|led unit|\bhead\b|bust|\bstand\b|figure|builders parts/i;

// 1980s kits use the short designations of the day.
const MODEL_ALIASES: Record<string, string> = { RX78: "rx-78-2", MS06: "ms-06f", MS06F2: "ms-06f", MS07: "ms-07b" };

const FACTION_ALIASES: [RegExp, string][] = [
  [/anti earth union|a\.?e\.?u\.?g/i, "AEUG"],
  [/earth federation/i, "EFSF"],
  [/neo zeon/i, "Neo Zeon"],
  [/principality of zeon|^zeon/i, "Zeon"],
  [/axis/i, "Axis"],
  [/titans/i, "Titans"],
  [/londo bell/i, "Londo Bell"],
  [/zaft/i, "ZAFT"],
  [/earth alliance|o\.?m\.?n\.?i/i, "Earth Alliance"],
  [/\borb\b/i, "Orb"],
  [/celestial being/i, "Celestial Being"],
  [/tekkadan/i, "Tekkadan"],
  [/gjallarhorn/i, "Gjallarhorn"],
];

// Build-universe suits have no in-universe year; place them by the series their kits belong to.
const BUILD_SERIES: [RegExp, string][] = [
  [/build fighters try/i, "build-11th"],
  [/build fighters/i, "build-8th"],
  [/re:?rise/i, "build-cov2"],
  [/build divers/i, "build-cov1"],
  [/gunpla builders/i, "build-2009"],
  [/metaverse|breaker|battlogue|build real/i, "build-cov2"],
];

type ColMap = ReturnType<typeof columnMap> & { series: number };
type MerchEntry = { page: Page; ref: SourceRef; row: MerchRow };
type MerchStats = { rows: number; withJan: number; attached: number; added: number; ambiguous: MerchEntry[]; noSuit: MerchEntry[] };
type Resolution = { kit: string; releaseId: string; why: string; kind: "ambiguous" | "contested" | "linked" };
type RawRow = { page: Page; ref: SourceRef; section: string; headers: string[]; row: Cell[]; col: ColMap; lineNo?: number };
type Stats = { page: string; tables: number; rows: number; kits: number; resolved: number; error?: string; ref?: SourceRef };
type FyiStats = { gundam: number; matched: number; unmatched: FyiProduct[]; error: string };
type KitPageStats = {
  pages: number;
  withJan: number;
  matched: number;
  added: number;
  ambiguous: number;
  contested: number;
  /** ambiguous/contested merges settled by a manual id or an explicit Gundam Wiki → Gunpla Wiki link */
  resolved: Resolution[];
  /** single-candidate merges refused because the manual ids contradict */
  vetoed: string[];
  noSuit: KitPage[];
  error: string;
};
type JanStats = { bySource: Record<string, number>; held: { jan: string; titles: string[]; why: string }[] };

const lineNumber = (cell?: Cell) => {
  const m = cell && /^\s*(\d{1,3})\b/.exec(cell.text);
  return m ? Number(m[1]) : undefined;
};
const yearOf = (d?: string) => (d ? Number(d.slice(0, 4)) : NaN);
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const linkTargets = (c?: Cell) => (c?.links ?? []).map((l) => l.target.split("#")[0].trim()).filter(Boolean);
const modelCell = (r: RawRow) => r.row[r.col.model] ?? r.row[r.col.modelNo];

async function collectRows(pages: Page[], stats: Stats[], merchOut?: MerchEntry[]): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  for (const page of pages) {
    const loaded = await loadPage(page, refresh);
    if ("error" in loaded) {
      stats.push({ page: page.title, tables: 0, rows: 0, kits: 0, resolved: 0, error: loaded.error });
      continue;
    }
    const st: Stats = { page: page.title, tables: 0, rows: 0, kits: 0, resolved: 0, ref: loaded.ref };
    for (const row of merchOut ? loaded.merch : []) {
      st.rows++;
      // `m=Suit#Mirasoul Flight Unit` on a row titled "Mirasoul Flight Unit": equipment, not a kit of that suit.
      const [suitPage, anchor] = (row.suitPages[0] ?? "").split(";")[0].split("#");
      const suitName = suitPage.trim().split(/\s+/).slice(1).join(" ");
      if (NOT_A_KIT.test(row.title) || (anchor && suitName && !row.title.toLowerCase().includes(suitName.toLowerCase()))) continue;
      st.kits++;
      merchOut!.push({ page, ref: loaded.ref, row });
    }
    for (const table of loaded.tables) {
      const col = { ...columnMap(table.headers), series: table.headers.findIndex((h) => /^series$|作品/i.test(h)) };
      if (col.model < 0 && col.modelNo < 0) continue;
      st.tables++;
      const section = table.headings.join(" / ") || "(top)";
      if (/option|オプション|accessor/i.test(section)) continue;
      for (const row of table.rows) {
        st.rows++;
        const model = row[col.model] ?? row[col.modelNo];
        if (!model || NOT_A_KIT.test(model.text)) continue;
        st.kits++;
        rows.push({ page, ref: loaded.ref, section, headers: table.headers, row, col, lineNo: lineNumber(row[col.no]) });
      }
    }
    stats.push(st);
  }
  return rows;
}

async function main() {
  const stats: Stats[] = [];
  const merchRows: MerchEntry[] = [];
  const primary = await collectRows(GUNDAM_WIKI_PAGES, stats, merchRows);
  const secondary = await collectRows(JA_WIKIPEDIA_PAGES, stats);

  // ── 2. suit discovery ────────────────────────────────────────────
  const titles = primary.flatMap((r) => linkTargets(modelCell(r)).slice(0, 3));
  console.log(`kit rows ${primary.length} · candidate suit pages ${new Set(titles).size}`);
  const boxes = await fetchInfoboxes(titles, refresh);

  const curatedByModel = new Map(curatedSuits.map((s) => [normModel(s.modelNumber), s]));
  const suitsById = new Map<string, DiscoveredSuit>();
  const suitByBoxTitle = new Map<string, DiscoveredSuit>();
  const suitByModel = new Map<string, DiscoveredSuit>();
  const unplaced = new Map<string, string>();

  const placeSuit = (box: Infobox, seriesHint: string): DiscoveredSuit | undefined => {
    const existing = suitByBoxTitle.get(box.title);
    if (existing) return existing;
    const timeline: TimelineId | undefined = timelineOf(box.era) ?? (BUILD_SERIES.some(([re]) => re.test(seriesHint)) ? "BUILD" : undefined);
    if (!timeline) {
      unplaced.set(box.title, `no timeline (era: ${box.era ?? "—"})`);
      return undefined;
    }
    const era: Era | undefined =
      timeline === "BUILD"
        ? eras.find((e) => e.id === (BUILD_SERIES.find(([re]) => re.test(seriesHint))?.[1] ?? "build-8th"))
        : stationFor(timeline, debutYear(box.first), eras);
    if (!era) {
      unplaced.set(box.title, `no station on ${timeline}`);
      return undefined;
    }

    const token = modelTokens([], box.title)[0];
    const words = box.title.split(/\s+/);
    // Display split only (IDs still derive from `token`): model numbers like "RX-79[G]" or
    // "GAT-X105+AQM/E-X01" fail the strict token pattern but are still the first word.
    const looksLikeModel = (w: string) => /^[A-Z∀][A-Za-z]{0,6}-?[A-Za-z0-9∀\-[\]/+.()]*\d/.test(w) || /^[A-Z∀][A-Z0-9∀]*-[A-Z0-9∀\-[\]/+.()]+$/.test(w);
    const splitTitle = (token || looksLikeModel(words[0])) && words.length > 1;
    const modelNumber = splitTitle ? words[0] : (box.english ?? box.title);
    const name = splitTitle ? words.slice(1).join(" ") : (box.english ?? box.title);
    // A curated id belongs to the page on the curated suit's own timeline; same-number pages from
    // other continuities (e.g. a Build Fighters "MSZ-006") must not take it.
    const curatedCandidate = token ? curatedByModel.get(token) : undefined;
    const curatedTimeline = curatedCandidate ? eras.find((e) => e.id === curatedCandidate.debutEraId)?.timelineId : undefined;
    const curated = curatedCandidate && curatedTimeline === timeline && !suitsById.has(curatedCandidate.id) ? curatedCandidate : undefined;
    let id = curated?.id ?? (token ? slug(modelNumber) : slug(box.title));
    if (!curated) for (let n = 2; suitsById.has(id); n++) id = `${slug(modelNumber)}-${slug(name).slice(0, 20)}${n > 2 ? `-${n}` : ""}`;

    const faction = FACTION_ALIASES.find(([re]) => box.operator && re.test(box.operator))?.[1] ?? box.operator?.slice(0, 28) ?? "Unaffiliated";
    const suit: DiscoveredSuit = {
      id,
      // Facts come from the infobox; data/suits.ts contributes editorial links only (variants, ordering).
      modelNumber,
      name,
      faction,
      pilot: box.pilot,
      variantOf: curated?.variantOf,
      variantKind: curated?.variantKind,
      continuity: curated?.continuity ?? "main",
      debutEraId: era.id,
      canonWeight: curated?.canonWeight ?? 0, // filled from kit counts below
      kanji: box.kanji,
      wikiTitle: box.title,
      source: infoboxRef(box),
    };
    suitsById.set(id, suit);
    suitByBoxTitle.set(box.title, suit);
    if (token && !suitByModel.has(token)) suitByModel.set(token, suit);
    return suit;
  };

  const resolveSuit = (r: RawRow): DiscoveredSuit | undefined => {
    const model = modelCell(r);
    const series = r.col.series >= 0 ? r.row[r.col.series]?.text : undefined;
    const hint = `${series ?? ""} ${r.page.title} ${r.section}`;
    for (const t of linkTargets(model).slice(0, 3)) {
      const box = boxes.get(t);
      if (box) return placeSuit(box, hint);
    }
    // No linked suit page: fall back to a model number in the text.
    const tok = (r.col.modelNo >= 0 && r.row[r.col.modelNo] ? modelTokens([], r.row[r.col.modelNo].text) : modelTokens([], model.text))[0];
    if (!tok) return undefined;
    const alias = MODEL_ALIASES[tok];
    return suitByModel.get(tok) ?? (alias ? suitsById.get(alias) : undefined);
  };

  // Two passes so text-only rows can resolve against suits discovered from linked rows.
  const pending = primary.map((r) => ({ r, suit: resolveSuit(r) }));
  for (const p of pending) if (!p.suit) p.suit = resolveSuit(p.r);
  for (const st of stats) st.resolved = pending.filter((p) => p.suit && p.r.page.title === st.page).length;
  const fyiData = await loadFyi(refresh).catch((e: unknown) => ({ error: String(e) }));
  const fyiTokens = (r: IngestedRelease) => nameTokens(`${r.name} ${suitsById.get(r.suitId)?.modelNumber ?? ""} ${suitsById.get(r.suitId)?.name ?? ""}`);

  // ── releases ─────────────────────────────────────────────────────
  const toRelease = (r: RawRow, suitId: string) => {
    const model = modelCell(r);
    const notes = r.col.notes >= 0 ? r.row[r.col.notes]?.text : undefined;
    const scale =
      (r.col.scale >= 0 ? r.row[r.col.scale]?.text : undefined) ?? /1\/(?:144|100|60|48|220)/.exec(`${model.text} ${notes ?? ""}`)?.[0] ?? r.page.scale;
    const extras: Record<string, string> = {};
    r.headers.forEach((h, i) => {
      if (![r.col.no, r.col.model, r.col.modelNo, r.col.price, r.col.date, r.col.notes, r.col.scale, r.col.series].includes(i) && r.row[i]?.text && !/^link$/i.test(h))
        extras[h] = r.row[i].text;
    });
    const pad = r.page.grade === "MG" || r.page.grade === "HG" ? 3 : 2;
    return {
      suitId,
      grade: r.page.grade,
      scale,
      lineNo: r.lineNo,
      lineLabel: r.lineNo !== undefined && r.page.linePrefix ? `${r.page.linePrefix} ${String(r.lineNo).padStart(pad, "0")}` : undefined,
      name: model.text,
      versionLabel: parseVersion(model.text) ?? parseVersion(r.section),
      edition: classifyEdition(r.section, model.text, !!r.page.linePrefix, r.lineNo !== undefined),
      releaseDate: r.col.date >= 0 ? parseReleaseDate(r.row[r.col.date]?.text ?? "") : undefined,
      yen: r.col.price >= 0 ? parseYen(r.row[r.col.price]?.text ?? "") : undefined,
      notes: notes || undefined,
      section: `${r.page.title} / ${r.section}`,
      extras,
      source: r.ref,
    };
  };

  // Corroboration index from Japanese Wikipedia, keyed by grade + line number + suit.
  const jaByLine = new Map<string, ReturnType<typeof toRelease>>();
  for (const r of secondary) {
    const tok = r.col.modelNo >= 0 ? modelTokens([], r.row[r.col.modelNo]?.text ?? "")[0] : undefined;
    const suit = tok ? (suitByModel.get(tok) ?? (MODEL_ALIASES[tok] ? suitsById.get(MODEL_ALIASES[tok]) : undefined)) : undefined;
    if (suit && r.lineNo !== undefined) jaByLine.set(`${r.page.grade}:${r.lineNo}:${suit.id}`, toRelease(r, suit.id));
  }

  const used = new Set<string>();
  const agrees = (a?: string, b?: string) => !!a && !!b && (a === b || ((a.length === 4 || b.length === 4) && yearOf(a) === yearOf(b)));
  const releases: IngestedRelease[] = [];
  for (const { r, suit } of pending) {
    if (!suit) continue;
    const { lineNo, ...rel } = toRelease(r, suit.id);
    const base = [
      rel.grade.toLowerCase(),
      lineNo !== undefined ? `${slug(r.page.linePrefix ?? "")}${String(lineNo).padStart(3, "0")}` : (rel.releaseDate ?? "nd").slice(0, 4),
      suit.id,
      rel.edition !== "standard" ? rel.edition : "",
      lineNo === undefined ? slug(rel.versionLabel ?? rel.name).slice(0, 16) : "",
    ]
      .filter(Boolean)
      .join("-");
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    const ja = lineNo !== undefined ? jaByLine.get(`${rel.grade}:${lineNo}:${suit.id}`) : undefined;
    releases.push({ ...rel, id, corroboration: ja ? [{ source: ja.source, releaseDate: ja.releaseDate, agrees: agrees(ja.releaseDate, rel.releaseDate) }] : [] });
  }

  // ── 3a. {{merch}} entries on Gundam Wiki list pages: JAN, manual id, Gunpla Wiki link ──
  const lineNum = (label?: string) => (label ? Number(/(\d+)\s*$/.exec(label)?.[1] ?? NaN) : NaN);
  const ms: MerchStats = { rows: merchRows.length, withJan: merchRows.filter((e) => e.row.jan).length, attached: 0, added: 0, ambiguous: [], noSuit: [] };
  const merchFate = new Map<MerchEntry, { suitId?: string; releaseId?: string; status: JanRecord["status"] }>();
  const merchJan = new Map<string, string>(); // release id → JAN its {{merch}} entry states (settled in 3c)
  {
    // "MSJ-121 Demi Trainer#YOASOBI Collaboration Ver.;…" → the primary suit's page
    const suitPage = (m: MerchRow) => m.suitPages[0]?.split(/[#;]/)[0].trim() || undefined;
    const unseen = merchRows.map((e) => suitPage(e.row)).filter((t): t is string => !!t && !boxes.has(t));
    for (const [t, b] of await fetchInfoboxes(unseen, refresh)) boxes.set(t, b);
    const claims = new Map<string, MerchEntry[]>();
    const fresh: { e: MerchEntry; suit: DiscoveredSuit }[] = [];
    for (const e of merchRows) {
      const t = suitPage(e.row);
      const box = t ? boxes.get(t) : undefined;
      const tok = modelTokens([], t ?? "")[0];
      const suit = box ? placeSuit(box, `${e.row.series ?? ""} ${e.page.title}`) : tok ? suitByModel.get(tok) : undefined;
      if (!suit) {
        ms.noSuit.push(e);
        merchFate.set(e, { status: "no-suit" });
        continue;
      }
      const st = stats.find((x) => x.page === e.page.title);
      if (st) st.resolved++;
      // Pages that also have tables (HGUC, The Origin) list the same kit twice: join on the line number.
      const samePage = releases.filter((r) => r.source.title === e.ref.title && r.grade === e.page.grade);
      const yearOk = (r: IngestedRelease) => !e.row.releaseDate || !r.releaseDate || yearOf(e.row.releaseDate) === yearOf(r.releaseDate);
      let pick: IngestedRelease[] = [];
      let blocked = false;
      if (samePage.length && !e.page.linePrefix) blocked = true; // no line labels to join on
      else if (e.row.number !== undefined) {
        const sameNo = samePage.filter((r) => lineNum(r.lineLabel) === e.row.number);
        pick = sameNo.filter((r) => r.suitId === suit.id && yearOk(r));
        blocked = sameNo.length > 0 && !pick.length; // the number belongs to another kit
      } else if (e.row.releaseDate && e.row.releaseDate.length >= 7) {
        pick = samePage.filter((r) => r.suitId === suit.id && r.releaseDate?.slice(0, 7) === e.row.releaseDate!.slice(0, 7));
      }
      if (pick.length === 1) claims.set(pick[0].id, [...(claims.get(pick[0].id) ?? []), e]);
      else if (pick.length > 1 || blocked) {
        ms.ambiguous.push(e);
        merchFate.set(e, { suitId: suit.id, status: "ambiguous" });
      } else fresh.push({ e, suit });
    }
    const merchOf = (e: MerchEntry): NonNullable<IngestedRelease["merch"]> => ({
      source: e.ref,
      title: e.row.title,
      number: e.row.number,
      manualId: e.row.manualId,
      gunplaWiki: e.row.gunplaWiki,
    });
    for (const [rid, es] of claims) {
      if (es.length !== 1) {
        for (const e of es) (ms.ambiguous.push(e), merchFate.set(e, { status: "ambiguous" }));
        continue;
      }
      const r = releases.find((x) => x.id === rid)!;
      r.merch = merchOf(es[0]);
      if (es[0].row.jan) merchJan.set(r.id, es[0].row.jan);
      merchFate.set(es[0], { suitId: r.suitId, releaseId: r.id, status: "attached" });
      ms.attached++;
    }
    for (const { e, suit } of fresh) {
      const { row, page } = e;
      if (!row.releaseDate) {
        merchFate.set(e, { suitId: suit.id, status: "no-date" });
        continue;
      }
      const ed = classifyEdition("", row.title, false, true);
      // Unnumbered rows on these pages are new kits or recolours; only the title can tell.
      const edition = ed === "standard" && /recirculation|\[[^\]]*colou?r[^\]]*\]/i.test(row.title) ? "recolor" : ed;
      const pad = page.grade === "MG" || page.grade === "HG" ? 3 : 2;
      const versionLabel = parseVersion(row.title);
      const base = [
        page.grade.toLowerCase(),
        row.number !== undefined ? `${slug(page.linePrefix ?? "")}${String(row.number).padStart(3, "0")}` : row.releaseDate.slice(0, 4),
        suit.id,
        edition !== "standard" ? edition : "",
        row.number === undefined ? slug(versionLabel ?? row.title).slice(0, 16) : "",
      ]
        .filter(Boolean)
        .join("-");
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      releases.push({
        id,
        suitId: suit.id,
        grade: page.grade,
        scale: /1\/(?:144|100|60|48|220)/.exec(row.title)?.[0] ?? page.scale,
        lineLabel: row.number !== undefined && page.linePrefix ? `${page.linePrefix} ${String(row.number).padStart(pad, "0")}` : undefined,
        name: row.title,
        versionLabel,
        edition,
        releaseDate: row.releaseDate,
        yen: row.yen,
        notes: row.note,
        section: `${page.title} / merch`,
        extras: {},
        source: e.ref,
        corroboration: [],
        merch: merchOf(e),
      });
      if (row.jan) merchJan.set(id, row.jan);
      merchFate.set(e, { suitId: suit.id, releaseId: id, status: "standalone" });
      ms.added++;
    }
  }

  // ── 3b. Gunpla Wiki kit pages: JAN, materials, glue/paint; fills gaps in the grade lists ──
  const kp: KitPageStats = { pages: 0, withJan: 0, matched: 0, added: 0, ambiguous: 0, contested: 0, resolved: [], vetoed: [], noSuit: [], error: "" };
  const js: JanStats = { bySource: {}, held: [] };
  const janRecords: JanRecord[] = [];
  try {
    const pages = (await loadKitPages(refresh)).filter((k) => k.grade);
    kp.pages = pages.length;
    kp.withJan = pages.filter((k) => k.jan).length;
    const fate = new Map<string, { suitId?: string; releaseId?: string; status: JanRecord["status"] }>();
    // Suits we haven't met yet: read their Gundam Wiki infoboxes too.
    const unseen = pages.map((k) => k.modelOf).filter((t): t is string => !!t && !boxes.has(t));
    for (const [t, b] of await fetchInfoboxes(unseen, refresh)) boxes.set(t, b);
    const suitFor = (k: KitPage) => {
      const box = k.modelOf ? boxes.get(k.modelOf) : undefined;
      if (box) return placeSuit(box, `${k.franchise ?? ""} ${k.classification}`);
      const tok = modelTokens([], k.modelOf ?? "")[0];
      return tok ? suitByModel.get(tok) : undefined;
    };
    // Stronger evidence for merges the rules below leave ambiguous or contested: the kit page's
    // Bandai manual id, matched either to the manual id on the release's {{merch}} entry or to the
    // gunpla.fyi product with that id (which must itself match the release under joinFyi's rules),
    // or a {{merch}} entry that links this very page. A manual id on two kit pages is not evidence.
    const manualCount = new Map<string, number>();
    for (const k of pages) if (k.manualId) manualCount.set(k.manualId, (manualCount.get(k.manualId) ?? 0) + 1);
    const manualOf = (k: KitPage) => (k.manualId && manualCount.get(k.manualId) === 1 ? k.manualId : undefined);
    const fyiById = new Map("products" in fyiData ? fyiData.products.map((p) => [p.id, p]) : []);
    const productOf = (k: KitPage) => {
      const m = manualOf(k);
      const p = m ? fyiById.get(m) : undefined;
      if (!p || fyiGrade(p.brand) !== k.grade) return undefined;
      if (k.releaseDate && k.releaseDate.length >= 7 && !(p.releaseDate ?? "").startsWith(k.releaseDate.slice(0, 7))) return undefined;
      return p;
    };
    const sameTitle = (a?: string, b?: string) => !!a && !!b && a.replace(/_/g, " ").trim().toLowerCase() === b.replace(/_/g, " ").trim().toLowerCase();
    // How many records of each source state a code: a link by JAN needs it to be unique in both.
    const janCount = (rows: { jan?: string }[]) => {
      const m = new Map<string, number>();
      for (const x of rows) if (x.jan) m.set(x.jan, (m.get(x.jan) ?? 0) + 1);
      return m;
    };
    const kpJans = janCount(pages);
    const merchJans = janCount(merchRows.map((e) => e.row));
    /** An explicit link from a release's {{merch}} entry to this kit page: the same unique JAN, or `gpl=` naming it. */
    const linked = (k: KitPage, r: IngestedRelease): string | undefined => {
      const j = merchJan.get(r.id);
      if (j && j === k.jan && kpJans.get(j) === 1 && merchJans.get(j) === 1) return `the Gundam Wiki {{merch}} entry states the same JAN ${j}`;
      return sameTitle(r.merch?.gunplaWiki, k.title) ? "the Gundam Wiki {{merch}} entry links this kit page" : undefined;
    };
    const contra = (k: KitPage, r: IngestedRelease) => !!manualOf(k) && !!r.merch?.manualId && r.merch.manualId !== manualOf(k);
    const evidence = (k: KitPage, r: IngestedRelease): string | undefined => {
      if (contra(k, r)) return undefined;
      const m = manualOf(k);
      if (m && r.merch?.manualId === m) return `manual id ${m} on both the kit page and the Gundam Wiki {{merch}} entry`;
      const l = linked(k, r);
      if (l) return l;
      const p = productOf(k);
      return p && fyiMatches(p, r, fyiTokens(r)) ? `manual id ${m} → gunpla.fyi "${p.nameEn}" (${p.releaseDate}), which matches this release` : undefined;
    };
    // Merge a kit page into a list-table release only when the match is unambiguous; a JAN
    // must never land on the wrong kit. Anything uncertain stays a standalone, JAN-keyed record.
    const versionsAgree = (a?: string, b?: string) => a === b || !a || !b;
    const claims = new Map<string, KitPage[]>(); // release id → kit pages claiming it
    const resolved: { k: KitPage; suit: DiscoveredSuit }[] = [];
    for (const k of pages) {
      const suit = suitFor(k);
      if (!suit) {
        kp.noSuit.push(k);
        fate.set(k.title, { status: "no-suit" });
        continue;
      }
      resolved.push({ k, suit });
      const kVer = parseVersion(k.title);
      const same = releases.filter((r) => r.suitId === suit.id && r.grade === k.grade && !r.id.startsWith("kp-") && versionsAgree(kVer, r.versionLabel));
      // 1) same lineup number, dates not contradicting
      let pick = same.filter(
        (r) => k.lineupNo !== undefined && lineNum(r.lineLabel) === k.lineupNo && (!k.releaseDate || !r.releaseDate || yearOf(k.releaseDate) === yearOf(r.releaseDate)),
      );
      // 2) otherwise the only release of this suit+grade in the same month
      if (!pick.length && k.releaseDate && k.releaseDate.length >= 7)
        pick = same.filter((r) => r.releaseDate && r.releaseDate.length >= 7 && r.releaseDate.slice(0, 7) === k.releaseDate!.slice(0, 7));
      // 0) an explicit {{merch}} link (same suit and grade) decides, unless rules 1–2 point elsewhere
      const link = same.filter((r) => linked(k, r) && !contra(k, r));
      if (link.length === 1 && (!pick.length || pick.includes(link[0]))) {
        if (pick.length !== 1 || pick[0] !== link[0]) kp.resolved.push({ kit: k.title, releaseId: link[0].id, why: linked(k, link[0])!, kind: pick.length ? "ambiguous" : "linked" });
        pick = link;
      }
      if (pick.length === 1 && contra(k, pick[0])) kp.vetoed.push(k.title);
      else if (pick.length === 1) claims.set(pick[0].id, [...(claims.get(pick[0].id) ?? []), k]);
      else if (pick.length > 1) {
        const ok = pick.filter((r) => evidence(k, r));
        if (ok.length === 1) {
          claims.set(ok[0].id, [...(claims.get(ok[0].id) ?? []), k]);
          kp.resolved.push({ kit: k.title, releaseId: ok[0].id, why: evidence(k, ok[0])!, kind: "ambiguous" });
        } else kp.ambiguous++;
      }
    }
    const usedK = new Set<string>();
    for (const [rid, ks] of claims) {
      const r = releases.find((x) => x.id === rid)!;
      let k = ks[0];
      if (ks.length !== 1) {
        // Two pages claim one release: trust neither, unless exactly one has evidence for it and
        // every other claimant is shown to be a different kit (a different, unshared manual id).
        const winners = ks.filter((x) => evidence(x, r));
        const w = winners.length === 1 ? winners[0] : undefined;
        const othersDiffer = !!w && ks.every((x) => x === w || contra(x, r) || (!!manualOf(x) && !!manualOf(w) && manualOf(x) !== manualOf(w)));
        if (!w || !othersDiffer) {
          kp.contested += ks.length;
          continue;
        }
        k = w;
        kp.resolved.push({ kit: k.title, releaseId: r.id, why: `${evidence(k, r)}; other claimants carry different manual ids (${ks.filter((x) => x !== w).map((x) => `${x.title}: ${manualOf(x) ?? "contradicts"}`).join("; ")})`, kind: "contested" });
      }
      usedK.add(k.title);
      fate.set(k.title, { suitId: r.suitId, releaseId: r.id, status: "attached" });
      r.kitPage = { source: k.ref, releaseDate: k.releaseDate, yen: k.yen, materials: k.materials, needsGlue: k.needsGlue, needsPaint: k.needsPaint };
    }
    kp.matched = usedK.size;
    // Kit pages the grade lists don't cover become releases of their own.
    for (const { k, suit } of resolved) {
      if (usedK.has(k.title)) continue;
      if (!k.releaseDate) {
        fate.set(k.title, { suitId: suit.id, status: "no-date" });
        continue;
      }
      let id = `kp-${slug(k.title)}`;
      for (let n = 2; used.has(id); n++) id = `${id}-${n}`;
      used.add(id);
      releases.push({
        id,
        suitId: suit.id,
        grade: k.grade!,
        scale: k.scale,
        lineLabel: k.lineupNo !== undefined ? `${k.classification.replace(/\s*\(.*$/, "")} ${String(k.lineupNo).padStart(3, "0")}` : undefined,
        name: k.title,
        versionLabel: parseVersion(k.title),
        edition: classifyEdition("", k.title, false, true),
        releaseDate: k.releaseDate,
        yen: k.yen,
        section: `Gunpla Wiki / ${k.classification}`,
        extras: {},
        source: k.ref,
        corroboration: [],
        kitPage: { source: k.ref, releaseDate: k.releaseDate, yen: k.yen, materials: k.materials, needsGlue: k.needsGlue, needsPaint: k.needsPaint },
      });
      fate.set(k.title, { suitId: suit.id, releaseId: id, status: "standalone" });
      kp.added++;
    }
    // ── 3c. JAN key: every statement from both sources, settled together ──
    type Stmt = Omit<JanRecord, "conflictsWith"> & { kitId: string; ok: boolean; conflictsWith: string[]; via: "kit-page" | "merch" };
    const stmts: Stmt[] = [];
    for (const k of pages) {
      if (!k.jan) continue;
      const f = fate.get(k.title) ?? { status: "no-suit" as const };
      stmts.push({ jan: k.jan, title: k.title, grade: k.grade, classification: k.classification, releaseDate: k.releaseDate, suitId: f.suitId, releaseId: f.releaseId, status: f.status, conflictsWith: [], source: k.ref, kitId: `kp:${k.title.toLowerCase()}`, ok: true, via: "kit-page" });
    }
    for (const e of merchRows) {
      if (!e.row.jan) continue;
      const f = merchFate.get(e) ?? { status: "no-suit" as const };
      // A {{merch}} entry naming a Gunpla Wiki page speaks about the same kit as that page.
      const kitId = e.row.gunplaWiki ? `kp:${e.row.gunplaWiki.replace(/_/g, " ").trim().toLowerCase()}` : `merch:${e.ref.title}:${e.row.title}`;
      stmts.push({ jan: e.row.jan, title: `${e.ref.title}: ${e.row.title}`, grade: e.page.grade, classification: e.page.title, releaseDate: e.row.releaseDate, suitId: f.suitId, releaseId: f.releaseId, status: f.status, conflictsWith: [], source: e.ref, kitId, ok: true, via: "merch" });
    }
    const byJan = new Map<string, Stmt[]>();
    for (const s of stmts) byJan.set(s.jan, [...(byJan.get(s.jan) ?? []), s]);
    for (const group of byJan.values()) {
      // Records speak about the same kit when they name the same kit page or sit on the same release.
      const comp = group.map((_, i) => i);
      const find = (i: number): number => (comp[i] === i ? i : (comp[i] = find(comp[i])));
      group.forEach((a, i) =>
        group.forEach((b, j) => {
          if (j > i && (a.kitId === b.kitId || (a.releaseId && a.releaseId === b.releaseId))) comp[find(i)] = find(j);
        }),
      );
      const kitOf = (s: Stmt) => find(group.indexOf(s));
      if (new Set(group.map(kitOf)).size > 1) {
        // The same code published for two different kits: the sources contradict each other.
        for (const s of group) Object.assign(s, { ok: false, status: "disputed", conflictsWith: group.filter((x) => kitOf(x) !== kitOf(s)).map((x) => x.title) });
      } else if (new Set(group.flatMap((s) => (s.releaseId ? [s.releaseId] : []))).size > 1) {
        // One kit, but our merge left its records on different releases: attach to neither.
        for (const s of group) Object.assign(s, { ok: false, status: "ambiguous" });
        js.held.push({ jan: group[0].jan, titles: group.map((s) => s.title), why: "same kit, records on different releases" });
      }
    }
    const byRelease = new Map<string, Stmt[]>();
    for (const s of stmts) if (s.ok && s.releaseId) byRelease.set(s.releaseId, [...(byRelease.get(s.releaseId) ?? []), s]);
    for (const [rid, group] of byRelease) {
      if (new Set(group.map((s) => s.jan)).size > 1) {
        // One release, two different codes: one of the sources is wrong and we can't tell which.
        for (const s of group) Object.assign(s, { ok: false, status: "disputed", conflictsWith: group.filter((x) => x.jan !== s.jan).map((x) => `${x.title} (${x.jan})`) });
        continue;
      }
      const r = releases.find((x) => x.id === rid)!;
      for (const s of group) {
        if (s.via === "kit-page" && r.kitPage) r.kitPage.jan = s.jan;
        if (s.via === "merch" && r.merch) r.merch.jan = s.jan;
      }
      const key = [r.kitPage?.jan ? "gunpla-wiki" : "", r.merch?.jan ? "gundam-wiki" : ""].filter(Boolean).join(" + ");
      js.bySource[key] = (js.bySource[key] ?? 0) + 1;
    }
    for (const { kitId: _k, ok: _o, via: _v, ...rec } of stmts) janRecords.push(rec);
  } catch (e) {
    kp.error = String(e);
  }

  // Kit counts drive "hero suits first" for discovered suits.
  const standardCount = new Map<string, number>();
  for (const r of releases) if (r.edition === "standard") standardCount.set(r.suitId, (standardCount.get(r.suitId) ?? 0) + 1);
  for (const s of suitsById.values()) if (!s.canonWeight) s.canonWeight = Math.min(95, 10 + 6 * (standardCount.get(s.id) ?? 0));

  // ── 4. gunpla.fyi product index ──────────────────────────────────
  const fyi = joinFyi(releases, fyiData, fyiTokens);

  // ── 6. de-duplicate: a kit-page/merch record and a list row describing the same product ──
  const dedupe = dedupeReleases(releases);

  // ── write ────────────────────────────────────────────────────────
  const usedSuitIds = new Set(releases.map((r) => r.suitId));
  const catalog = Catalog.parse({
    generatedAt: new Date().toISOString(),
    suits: [...suitsById.values()].filter((s) => usedSuitIds.has(s.id)),
    releases,
    jans: janRecords,
  });
  writeFileSync(join(OUT, "catalog.json"), `${JSON.stringify(catalog)}\n`);
  const unresolved = pending.filter((p) => !p.suit).map((p) => p.r);
  writeFileSync(join(OUT, "ingest-report.md"), report(catalog, stats, unresolved, unplaced, dedupe, fyi, kp, ms, js));

  console.log(
    `suits ${catalog.suits.length} · releases ${releases.length} (standard ${releases.filter((r) => r.edition === "standard").length}) · duplicates merged ${dedupe.merged.length} · unresolved rows ${unresolved.length}`,
  );
  console.log(`gunpla.fyi: ${fyi.error || `${fyi.matched}/${fyi.gundam} Gundam products matched`}`);
  console.log(`Gunpla Wiki: ${kp.error || `${kp.pages} kit pages · ${kp.withJan} with JAN · merged ${kp.matched} · standalone ${kp.added} · ambiguous ${kp.ambiguous} · contested ${kp.contested} · no suit ${kp.noSuit.length}`}`);
  const byStatus: Record<string, number> = {};
  for (const j of janRecords) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
  console.log(`Gundam Wiki {{merch}}: ${ms.rows} kit rows · ${ms.withJan} with JAN · attached ${ms.attached} · standalone ${ms.added} · ambiguous ${ms.ambiguous.length} · no suit ${ms.noSuit.length}`);
  console.log(`kit-page merges settled by manual id / merch link: ${kp.resolved.length} · vetoed ${kp.vetoed.length} · JANs on releases by source: ${JSON.stringify(js.bySource)}`);
  console.log(`JAN key table: ${janRecords.length} (${JSON.stringify(byStatus)}) · on releases: ${releases.filter((r) => r.kitPage?.jan || r.merch?.jan).length}`);
  const perTimeline: Record<string, number> = {};
  for (const s of catalog.suits) {
    const t = eras.find((e) => e.id === s.debutEraId)!.timelineId;
    perTimeline[t] = (perTimeline[t] ?? 0) + 1;
  }
  console.log("suits per timeline:", perTimeline);
}

/**
 * A standalone record (Gunpla Wiki kit page or {{merch}} entry) and a list-table row
 * can describe the same product when the strict JAN merge refused to guess. Fold the
 * list row into the standalone record only when the evidence is exact: the same Bandai
 * manual id, or the same suit + grade + month with near-identical names and no rival
 * candidate. The JAN stays with the record that published it.
 */
function dedupeReleases(releases: IngestedRelease[]): { merged: string[] } {
  const merged: string[] = [];
  const isStandalone = (r: IngestedRelease) => r.id.startsWith("kp-") || r.section.endsWith("/ merch");
  const manualId = (r: IngestedRelease) => r.merch?.manualId ?? (r.bandai ? /detail\/(\d+)/.exec(r.bandai.manualUrl)?.[1] : undefined);
  const month = (r: IngestedRelease) => (r.releaseDate && r.releaseDate.length >= 7 ? r.releaseDate.slice(0, 7) : undefined);
  const tokens = new Map(releases.map((r) => [r.id, nameTokens(r.name)]));
  const drop = new Set<string>();
  for (const s of releases.filter(isStandalone)) {
    const rivals = releases.filter(
      (r) => !isStandalone(r) && !drop.has(r.id) && r.suitId === s.suitId && r.grade === s.grade && !r.kitPage?.jan && !r.merch?.jan,
    );
    const byManual = manualId(s) ? rivals.filter((r) => manualId(r) === manualId(s)) : [];
    const byName = rivals.filter(
      (r) => month(r) && month(r) === month(s) && (r.versionLabel ?? "") === (s.versionLabel ?? "") && jaccard(tokens.get(r.id)!, tokens.get(s.id)!) >= 0.75,
    );
    const pick = byManual.length === 1 ? byManual[0] : byManual.length === 0 && byName.length === 1 ? byName[0] : undefined;
    if (!pick) continue;
    s.lineLabel ??= pick.lineLabel;
    s.yen ??= pick.yen;
    s.notes ??= pick.notes;
    s.bandai ??= pick.bandai;
    if (s.edition === "standard" && pick.edition !== "standard") s.edition = pick.edition;
    s.corroboration = [...s.corroboration, { source: pick.source, releaseDate: pick.releaseDate, agrees: !!pick.releaseDate && !!s.releaseDate && s.releaseDate.startsWith(pick.releaseDate.slice(0, 7)) }, ...pick.corroboration];
    drop.add(pick.id);
    merged.push(`${pick.lineLabel ?? pick.name} → ${s.name}`);
  }
  for (let i = releases.length - 1; i >= 0; i--) if (drop.has(releases[i].id)) releases.splice(i, 1);
  return { merged };
}

const FYI_MIN_SCORE = 0.6;

/** joinFyi's rule for one pair: same grade, same month, name similarity ≥ FYI_MIN_SCORE. */
function fyiMatches(p: FyiProduct, r: IngestedRelease, releaseTokens: Set<string>) {
  const sameMonth = !!r.releaseDate && r.releaseDate.length >= 7 && (p.releaseDate ?? "").startsWith(r.releaseDate.slice(0, 7));
  return fyiGrade(p.brand) === r.grade && sameMonth && jaccard(nameTokens(p.nameEn), releaseTokens) >= FYI_MIN_SCORE;
}

/** Match gunpla.fyi products to releases by grade + year + name similarity (+ same month). */
function joinFyi(releases: IngestedRelease[], data: Awaited<ReturnType<typeof loadFyi>> | { error: string }, releaseTokens: (r: IngestedRelease) => Set<string>): FyiStats {
  const stats: FyiStats = { gundam: 0, matched: 0, unmatched: [], error: "" };
  try {
    if ("error" in data) throw new Error(data.error);
    const { products, ref } = data;
    const gundam = products.filter((p) => fyiGrade(p.brand) && !NOT_A_KIT.test(p.nameEn));
    stats.gundam = gundam.length;
    const tokens = new Map(releases.map((r) => [r.id, releaseTokens(r)]));
    const byGradeYear = new Map<string, IngestedRelease[]>();
    for (const r of releases) {
      const k = `${r.grade}:${(r.releaseDate ?? "").slice(0, 4)}`;
      if (!byGradeYear.has(k)) byGradeYear.set(k, []);
      byGradeYear.get(k)!.push(r);
    }
    const scored: { p: FyiProduct; r: IngestedRelease; score: number }[] = [];
    for (const p of gundam) {
      const pt = nameTokens(p.nameEn);
      for (const r of byGradeYear.get(`${fyiGrade(p.brand)}:${(p.releaseDate ?? "").slice(0, 4)}`) ?? []) {
        const sameMonth = !!r.releaseDate && r.releaseDate.length >= 7 && (p.releaseDate ?? "").startsWith(r.releaseDate.slice(0, 7));
        const score = jaccard(pt, tokens.get(r.id)!);
        if (sameMonth && score >= FYI_MIN_SCORE) scored.push({ p, r, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    const usedP = new Set<string>();
    for (const { p, r } of scored) {
      if (usedP.has(p.id) || r.bandai || !p.partNo || !/^\d{5,8}$/.test(p.partNo)) continue;
      usedP.add(p.id);
      r.bandai = {
        itemCode: p.partNo,
        nameEn: p.nameEn,
        nameJp: p.nameJp,
        releaseDate: p.releaseDate ?? "",
        manualUrl: `https://manual.bandai-hobby.net/menus/detail/${p.id}`,
        source: ref,
      };
    }
    stats.matched = usedP.size;
    stats.unmatched = gundam.filter((p) => !usedP.has(p.id));
  } catch (e) {
    stats.error = String(e);
  }
  return stats;
}

function report(cat: Catalog, stats: Stats[], unresolved: RawRow[], unplaced: Map<string, string>, dedupe: { merged: string[] }, fyi: FyiStats, kp: KitPageStats, ms: MerchStats, js: JanStats) {
  const L: string[] = [];
  const rels = cat.releases;
  L.push("# Ingest report", "", `Generated ${cat.generatedAt} by \`npm run ingest\`. Do not edit by hand.`, "");
  L.push(
    `**${cat.suits.length} suits · ${rels.length} releases** (${rels.filter((r) => r.edition === "standard").length} standard) · ${rels.filter((r) => r.kitPage?.jan).length} with JAN · ${rels.filter((r) => r.bandai).length} with Bandai item code · ${rels.filter((r) => r.kitPage?.materials.length).length} with materials`,
    "",
  );

  L.push("## Coverage by station", "", "| Station | Suits | Releases |", "|---|---|---|");
  for (const e of eras) {
    const ids = new Set(cat.suits.filter((s) => s.debutEraId === e.id).map((s) => s.id));
    L.push(`| ${e.code} · ${e.label} | ${ids.size} | ${rels.filter((r) => ids.has(r.suitId)).length} |`);
  }

  L.push("", "## Sources", "", "| Source | Page | Revision | License | Tables | Kit rows | Resolved to a suit |", "|---|---|---|---|---|---|---|");
  for (const s of stats)
    L.push(`| ${s.ref?.name ?? "—"} | ${s.ref ? `[${s.page}](${s.ref.url})` : s.page} | ${s.ref?.revid ?? "—"} | ${s.ref?.license ?? "—"} | ${s.tables} | ${s.kits} | ${s.error ? `✗ ${s.error}` : s.resolved} |`);
  L.push(`| gunpla-wiki | [Gunpla Wiki](https://gunpla.fandom.com) kit pages | per page | CC BY-SA | — | ${kp.pages} kit pages (${kp.withJan} with JAN) | ${kp.error ? `✗ ${kp.error}` : `${kp.matched} merged into list rows · ${kp.added} standalone · ${kp.ambiguous} ambiguous + ${kp.contested} contested kept separate`} |`);
  L.push(`| gundam-wiki | {{merch}} entries on the list pages above | per page | CC BY-SA 3.0 | — | ${ms.rows} kit rows (${ms.withJan} with JAN) | ${ms.attached} joined to table rows · ${ms.added} standalone · ${ms.ambiguous.length} ambiguous · ${ms.noSuit.length} no suit |`);
  L.push(`| gunpla-fyi | [gunpla.fyi](https://gunpla.fyi) product index | — | factual data | — | ${fyi.gundam} Gundam products | ${fyi.error ? `✗ ${fyi.error}` : `${fyi.matched} matched`} |`);

  const janRels = rels.filter((r) => r.kitPage?.jan || r.merch?.jan);
  L.push("", `## JAN by source (${janRels.length} releases)`, "", "A release carries a JAN only when every source record that speaks about it states the same code and no other record uses that code for another kit.", "", "| Stated by | Releases |", "|---|---|");
  for (const [k, n] of Object.entries(js.bySource).sort((a, b) => b[1] - a[1])) L.push(`| ${k === "gunpla-wiki" ? "Gunpla Wiki kit page only" : k === "gundam-wiki" ? "Gundam Wiki {{merch}} entry only" : "both, agreeing"} | ${n} |`);
  const jStatus: Record<string, Record<string, number>> = {};
  for (const j of cat.jans) {
    const src = j.source.name;
    jStatus[src] ??= {};
    jStatus[src][j.status] = (jStatus[src][j.status] ?? 0) + 1;
  }
  L.push("", "Key-table records by source and status:", "", "| Source | attached | standalone | ambiguous | no-suit | no-date | disputed |", "|---|---|---|---|---|---|---|");
  for (const [src, st] of Object.entries(jStatus)) L.push(`| ${src} | ${["attached", "standalone", "ambiguous", "no-suit", "no-date", "disputed"].map((k) => st[k] ?? 0).join(" | ")} |`);
  if (js.held.length) {
    L.push("", "Held back (same kit, but its records sit on different releases):", "");
    for (const h of js.held) L.push(`- \`${h.jan}\` ${h.titles.join(" · ")}`);
  }

  L.push("", `## Kit-page merges settled by stronger evidence (${kp.resolved.length})`, "", `Merges decided by a Bandai manual id or an explicit {{merch}} → kit-page link (the same unique JAN, or \`gpl=\` naming the page), always within the same suit and grade; the list-table thresholds are unchanged. "linked" rows had no candidate under those thresholds. ${kp.ambiguous} ambiguous and ${kp.contested} contested remain. ${kp.vetoed.length} single-candidate merges refused because manual ids contradict.`, "");
  for (const x of kp.resolved) L.push(`- ${x.kind}: ${x.kit} → \`${x.releaseId}\` (${x.why})`);
  for (const t of kp.vetoed) L.push(`- vetoed: ${t}`);

  L.push("", `## {{merch}} entries not used (${ms.ambiguous.length + ms.noSuit.length})`, "");
  for (const e of ms.ambiguous) L.push(`- ambiguous: ${e.page.title} · ${e.row.number ?? "—"} ${e.row.title}`);
  for (const e of ms.noSuit) L.push(`- no suit: ${e.page.title} · ${e.row.title} (m: ${e.row.suitPages.join(", ") || "—"})`);

  L.push("", `## Duplicates merged (${dedupe.merged.length})`, "", "List-table rows folded into the standalone record for the same product (same manual id, or same suit/grade/month with near-identical names).", "");
  for (const m of dedupe.merged) L.push(`- ${m}`);

  const disagreements = rels.filter((r) => r.corroboration.some((c) => !c.agrees));
  L.push("", `## Cross-source disagreements (${disagreements.length})`, "");
  for (const r of disagreements)
    for (const c of r.corroboration.filter((x) => !x.agrees)) L.push(`- ${r.lineLabel ?? r.name}: Gundam Wiki ${r.releaseDate ?? "?"} vs ${c.source.name} ${c.releaseDate ?? "?"}`);

  L.push("", `## Suit pages without a timeline (${unplaced.size})`, "", "Infobox `era` not recognised. Extend `ERA_TIMELINE` in discover.ts if these matter.", "");
  for (const [t, why] of [...unplaced].slice(0, 80)) L.push(`- ${t}: ${why}`);

  L.push("", `## Kit rows not resolved to a suit (${unresolved.length})`, "", "Usually non-Gundam mecha, vehicles, or rows without a suit link. First 80:", "");
  for (const r of unresolved.slice(0, 80)) L.push(`- ${r.page.title}: ${modelCell(r)?.text}`);

  const disputedJans = cat.jans.filter((j) => j.status === "disputed");
  L.push("", `## Disputed JANs (${disputedJans.length})`, "", "The same barcode is published for more than one kit (on Gunpla Wiki kit pages or Gundam Wiki {{merch}} entries), or one kit's records publish different barcodes. Kept in the key table but not used until a human resolves it on the wiki.", "");
  for (const j of disputedJans) L.push(`- \`${j.jan}\` ${j.title} ↔ ${j.conflictsWith.join("; ")}`);

  L.push("", `## Gunpla Wiki kit pages without a resolvable suit (${kp.noSuit.length})`, "", "First 60.", "");
  for (const k of kp.noSuit.slice(0, 60)) L.push(`- ${k.title} (model of: ${k.modelOf ?? "—"})`);

  L.push("", `## gunpla.fyi products not matched (${fyi.unmatched.length})`, "", "First 80. Kits on pages not yet ingested, or names too different to match safely.", "");
  for (const p of fyi.unmatched.slice(0, 80)) L.push(`- ${p.brand} · ${p.nameEn} (${p.releaseDate ?? "?"}, item ${p.partNo ?? "?"})`);

  L.push(
    "",
    "## Not covered by open sources",
    "",
    "- **JAN barcodes**: taken only from Gunpla Wiki kit pages and Gundam Wiki {{merch}} entries that state them (EAN-13 check digit validated). Kits with neither have none yet.",
    "- **Build scores** (stability, articulation, part counts, build time): no open source states them per kit, so the app shows none.",
    "",
    "Gundam Wiki and Wikipedia content is CC BY-SA; derived data here carries the same license. gunpla.fyi data is factual (names, item codes, dates), used with attribution; box art is not copied.",
  );
  return `${L.join("\n")}\n`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
