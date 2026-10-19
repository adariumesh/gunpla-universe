import type { Grade, SourceRef } from "../../lib/schema";
import { fetchJson } from "./http";
import { parseReleaseDate, parseYen } from "./normalize";
import { cleanCell, splitTop } from "./wikitext";

/*
 * Gunpla Wiki (gunpla.fandom.com, CC BY-SA): one page per kit with a
 * {{Plamo Infobox}} carrying lineup number, exact release date, price,
 * JAN/ISBN, materials (PS/PE/ABS/KPS), glue and paint requirements, and the
 * suit page it models. This is the open source for JAN barcodes and the
 * sourced part of the engineering data.
 */

const API = "https://gunpla.fandom.com/api.php";
const BASE = "https://gunpla.fandom.com/wiki/";

export type KitPage = {
  title: string;
  ref: SourceRef;
  grade?: Grade;
  classification: string;
  lineupNo?: number;
  scale?: string;
  releaseDate?: string; // YYYY-MM-DD when the day is given
  yen?: number;
  jan?: string;
  needsGlue?: boolean;
  needsPaint?: boolean;
  materials: string[];
  modelOf?: string;
  japaneseName?: string;
  franchise?: string;
  /** Bandai manual page id (manual.bandai-hobby.net/menus/detail/<id>) when the page links exactly one */
  manualId?: string;
};

type Embedded = { query?: { embeddedin: { title: string }[] }; continue?: { eicontinue: string } };
type Revs = { query?: { pages: Record<string, { title: string; revisions?: { revid: number; slots: { main: { "*": string } } }[] }> } };

/** Non-Gundam Bandai lines that share the wiki. */
const NOT_GUNDAM = /30 minutes|figure-rise|keroro|haropla|petiture|girl gun|toku collection|option parts/i;

export function gradeFromClassification(c: string): Grade | undefined {
  const s = c.toLowerCase();
  if (!s || NOT_GUNDAM.test(s)) return undefined;
  if (/master grade sd|mgsd/.test(s)) return "MGSD";
  if (/master grade|^mg\b/.test(s)) return "MG";
  if (/perfect grade|^pg\b/.test(s)) return "PG";
  if (/real grade|^rg\b/.test(s)) return "RG";
  if (/entry grade/.test(s)) return "EG";
  if (/reborn|re\/100/.test(s)) return "RE100";
  if (/full mechanics/.test(s)) return "FM";
  if (/first grade/.test(s)) return "FG";
  if (/mega size/.test(s)) return "MEGA";
  if (/\bsd\b|super deformed|bb senshi|cross silhouette|ex-standard/.test(s)) return "SD";
  if (/high grade|^hg/.test(s)) return "HG";
  if (/model series|no grade|non-grade|original|^1\/(144|100|60|220|1200)/.test(s)) return "VINTAGE";
  if (/advanced grade|hi-resolution|mecha collection|mechanic collection|ex model|assemble|limited model|speed grade|ultimagear|furoku|full color|custom kit/.test(s)) return "OTHER";
  return undefined;
}

/** EAN-13 check digit. */
export function validJan(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const sum = [...code.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

/** "December 14, 2013" → "2013-12-14"; falls back to month precision. */
export function exactDate(text: string): string | undefined {
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const m = /([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(text);
  const mi = m ? months.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3))) : -1;
  if (m && mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return parseReleaseDate(text);
}

function parsePlamoInfobox(text: string): Record<string, string> | undefined {
  const start = text.indexOf("{{Plamo Infobox");
  if (start < 0) return undefined;
  let depth = 0;
  let end = start;
  for (; end < text.length - 1; end++) {
    if (text.startsWith("{{", end)) (depth++, end++);
    else if (text.startsWith("}}", end)) {
      depth--;
      end++;
      if (depth === 0) break;
    }
  }
  const inner = text.slice(start + 2, end - 1);
  const fields: Record<string, string> = {};
  for (const part of splitTop(inner, "|").slice(1)) {
    const eq = part.indexOf("=");
    if (eq > 0) fields[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
  }
  return fields;
}

const yesNo = (v?: string) => (v ? (/^\s*yes/i.test(v) ? true : /^\s*no/i.test(v) ? false : undefined) : undefined);

export async function loadKitPages(refresh = false): Promise<KitPage[]> {
  const titles: string[] = [];
  let cont: string | undefined;
  do {
    const url = `${API}?action=query&format=json&list=embeddedin&eititle=Template:Plamo_Infobox&einamespace=0&eilimit=500${cont ? `&eicontinue=${encodeURIComponent(cont)}` : ""}`;
    const snap = await fetchJson<Embedded>("gunpla-wiki", url, refresh);
    titles.push(...(snap.body.query?.embeddedin ?? []).map((p) => p.title));
    cont = snap.body.continue?.eicontinue;
  } while (cont);

  const out: KitPage[] = [];
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const url = `${API}?action=query&format=json&prop=revisions&rvprop=ids%7Ccontent&rvslots=main&titles=${encodeURIComponent(batch.join("|"))}`;
    const snap = await fetchJson<Revs>("gunpla-wiki", url, refresh);
    for (const page of Object.values(snap.body.query?.pages ?? {})) {
      const rev = page.revisions?.[0];
      const box = rev && parsePlamoInfobox(rev.slots.main["*"]);
      if (!box) continue;
      const v = (k: string) => (box[k] ? cleanCell(box[k]).text : undefined);
      const classification = v("classification") ?? "";
      const janRaw = (box["jan/isbn"] ?? "").replace(/\D/g, "");
      const manualIds = new Set([...rev.slots.main["*"].matchAll(/manual\.bandai-hobby\.net\/menus\/detail\/(\d+)/g)].map((m) => m[1]));
      out.push({
        title: page.title,
        ref: { name: "gunpla-wiki", title: page.title, url: BASE + encodeURIComponent(page.title.replace(/ /g, "_")), revid: rev.revid, license: "CC BY-SA", fetchedAt: snap.fetchedAt },
        // Blank classification: fall back to the grade prefix in the page title ("HGUC …", "MG …").
        grade: classification ? gradeFromClassification(classification) : gradeFromClassification(page.title.split(/\s+/)[0]),
        classification,
        lineupNo: v("lineup no.") && /^\d+/.test(v("lineup no.")!) ? Number(/^\d+/.exec(v("lineup no.")!)![0]) : undefined,
        scale: v("scale"),
        releaseDate: v("release date") ? exactDate(v("release date")!) : undefined,
        yen: v("price") ? parseYen(v("price")!) : undefined,
        jan: validJan(janRaw) && /^4[59]/.test(janRaw) ? janRaw : undefined,
        needsGlue: yesNo(v("need glue?")),
        needsPaint: yesNo(v("need to paint?")),
        materials: (v("materials") ?? "").split(/[,/]/).map((m) => m.replace(/\(.*?\)/g, "").trim().toUpperCase()).filter(Boolean),
        modelOf: box["model of"] ? (cleanCell(box["model of"]).links[0]?.target ?? v("model of")) : undefined,
        japaneseName: v("japanese name"),
        franchise: v("franchise"),
        manualId: manualIds.size === 1 ? [...manualIds][0] : undefined,
      });
    }
  }
  return out;
}
