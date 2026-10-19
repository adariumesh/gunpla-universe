import type { Grade, SourceRef } from "../../lib/schema";
import { fetchJson } from "./http";
import { parseMerch, type MerchRow } from "./merch";
import { parseTables, type Table } from "./wikitext";

/*
 * Open, license-compatible sources (CC BY-SA). Official Bandai pages are used
 * for link-outs and manual spot checks only: they reject automated clients.
 */

export type Page = { source: "gundam-wiki" | "ja-wikipedia"; title: string; grade: Grade; linePrefix?: string; scale?: string };

const wiki = (title: string, grade: Grade, linePrefix?: string, scale?: string): Page => ({ source: "gundam-wiki", title, grade, linePrefix, scale });

/** Every Gundam Gunpla line with a list page on Gundam Wiki. Non-kit rows are filtered downstream. */
export const GUNDAM_WIKI_PAGES: Page[] = [
  wiki("Master Grade", "MG", "MG", "1/100"),
  wiki("Real Grade", "RG", "RG", "1/144"),
  wiki("Perfect Grade", "PG", "PG", "1/60"),
  wiki("Entry Grade", "EG", "EG", "1/144"),
  wiki("First Grade", "FG", "FG", "1/144"),
  wiki("Mega Size Model", "MEGA", undefined, "1/48"),
  wiki("Reborn-One Hundred", "RE100", "RE/100", "1/100"),
  wiki("Full Mechanics", "FM", undefined, "1/100"),
  wiki("Master Grade SD", "MGSD", undefined, "NS"),
  // High Grade sub-lines
  ...[
    ["High Grade Universal Century", "HGUC"],
    ["High Grade (1990)", undefined],
    ["High Grade-EX", undefined],
    ["High Grade After Colony", "HGAC"],
    ["High Grade After War", undefined],
    ["High Grade Fighting Action", undefined],
    ["High Grade Gundam SEED", "HG SEED"],
    ["High Grade Gundam 00", "HG 00"],
    ["High Grade Gundam AGE", "HG AGE"],
    ["High Grade IRON-BLOODED ORPHANS", "HG IBO"],
    ["High Grade the Witch from Mercury", "HG WFM"],
    ["High Grade Reconguista in G", "HG G-Reco"],
    ["High Grade Gundam The Origin", "HG GTO"],
    ["High Grade Gundam Thunderbolt", "HG GTB"],
    ["High Grade Mobile Suit Gundam: The 08th MS Team", undefined],
    ["High Grade Mobile Suit Gundam: Cucuruz Doan's Island", undefined],
    ["High Grade Mobile Suit Gundam GQuuuuuuX", undefined],
    ["High Grade Gundam Wing Dual Story G-Unit", undefined],
    ["High Grade Beyond Global", undefined],
    ["High Grade G40", undefined],
    ["High Grade Ver.G30th", undefined],
    ["High Grade Build Fighters", "HGBF"],
    ["High Grade Build Custom", "HGBC"],
    ["High Grade Build Divers", "HGBD"],
    ["High Grade Build Divers Re:RISE", "HGBD:R"],
    ["High Grade Gundam Build Metaverse", "HGBM"],
    ["High Grade Gundam Breaker Battlogue", undefined],
    ["High Grade Gunpla Builders", undefined],
  ].map(([t, prefix]) => wiki(t as string, "HG", prefix, "1/144")),
  // 1990s 1/100 High Grade lines
  ...[
    "1/100 High Grade Endless Waltz Model Series",
    "1/100 High Grade G Gundam Model Series",
    "1/100 High Grade Gundam Wing Model Series",
    "1/100 High Grade Gundam X Model Series",
    "1/100 High Grade Victory Gundam Model Series",
  ].map((t) => wiki(t, "HG", undefined, "1/100")),
  // SD lines
  wiki("SD Gundam BB Senshi", "SD", "BB", "NS"),
  wiki("SD Gundam Cross Silhouette", "SD", "SDCS", "NS"),
  wiki("SD Gundam EX-Standard", "SD", "SDEX", "NS"),
  wiki("SD Gundam G Generation Model Series", "SD", undefined, "NS"),
  // No Grade / vintage model series
  ...[
    "Mobile Suit Gundam Model Series",
    "Mobile Suit Variations Model Series",
    "1/144 Mobile Suit Gundam 0080 Model Series",
    "1/144 Mobile Suit Gundam 0083 Model Series",
    "Mobile Suit Zeta Gundam Model Series",
    "Mobile Suit Gundam ZZ Model Series",
    "Mobile Suit Gundam: Char's Counterattack Model Series",
    "1/144 Gundam Sentinel Model Series",
    "1/100 Gundam F90 Model Series",
    "1/100 Gundam F91 Model Series",
    "1/100 Silhouette Formula 91 Model Series",
    "1/144 Victory Gundam Model Series",
    "1/144 G Gundam Model Series",
    "1/144 Gundam Wing Model Series",
    "1/144 Gundam X Model Series",
    "1/144 Gundam SEED Model Series",
    "1/100 Gundam SEED Model Series",
    "1/100 Gundam 00 Model Series",
    "1/100 IRON-BLOODED ORPHANS",
    "1/60 Gundam Model Series",
  ].map((t) => wiki(t, "VINTAGE")),
];

export const JA_WIKIPEDIA_PAGES: Page[] = [
  { source: "ja-wikipedia", title: "マスターグレード", grade: "MG", linePrefix: "MG" },
  { source: "ja-wikipedia", title: "リアルグレード", grade: "RG", linePrefix: "RG" },
  { source: "ja-wikipedia", title: "パーフェクトグレード", grade: "PG", linePrefix: "PG" },
];

const API: Record<"gundam-wiki" | "ja-wikipedia", { api: string; base: string; license: string }> = {
  "gundam-wiki": { api: "https://gundam.fandom.com/api.php", base: "https://gundam.fandom.com/wiki/", license: "CC BY-SA 3.0" },
  "ja-wikipedia": { api: "https://ja.wikipedia.org/w/api.php", base: "https://ja.wikipedia.org/wiki/", license: "CC BY-SA 4.0" },
};

type ParseResponse = { parse?: { title: string; revid: number; wikitext: { "*": string } }; error?: { code: string; info: string } };

export async function loadPage(page: Page, refresh = false): Promise<{ ref: SourceRef; tables: Table[]; merch: MerchRow[] } | { error: string }> {
  const { api, base, license } = API[page.source];
  const url = `${api}?action=parse&format=json&redirects=1&prop=wikitext%7Crevid&page=${encodeURIComponent(page.title)}`;
  const snap = await fetchJson<ParseResponse>(page.source, url, refresh);
  if (!snap.body.parse) return { error: `${page.title}: ${snap.body.error?.code ?? "no parse"}` };
  const p = snap.body.parse;
  return {
    ref: {
      name: page.source,
      title: p.title,
      url: base + encodeURIComponent(p.title.replace(/ /g, "_")),
      revid: p.revid,
      license,
      fetchedAt: snap.fetchedAt,
    },
    tables: parseTables(p.wikitext["*"]),
    merch: parseMerch(p.wikitext["*"]),
  };
}

/** Maps a table's header row to the columns we care about. */
export function columnMap(headers: string[]) {
  const find = (re: RegExp) => headers.findIndex((h) => re.test(h));
  return {
    no: find(/#|^no\.?$|^番号$|^No\.$/i),
    model: find(/^(model|kit|name|商品名|名称|機体名)/i),
    modelNo: find(/型式番号|型番/),
    price: find(/price|yen|価格/i),
    date: find(/release|発売/i),
    notes: find(/note|備考/i),
    scale: find(/scale|スケール/i),
  };
}
