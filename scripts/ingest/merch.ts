import { exactDate, validJan } from "./gunplawiki";
import { cleanCell, splitTop } from "./wikitext";

/*
 * Gundam Wiki's newer list pages ("High Grade the Witch from Mercury", parts of
 * HGUC / The Origin) put each kit in a {{merch}} template inside the page
 * infobox instead of a table:
 *
 *   {{merch |number=1 |title=Gundam Lfrith |id=JAN 4573102629449 |dt=2022-08-06
 *     |yen=1600 |m=XGF-02 Gundam Lfrith |gpl=HGTWFM XGF-02 Gundam Lfrith
 *     |man=https://manual.bandai-hobby.net/menus/detail/127 }}
 *
 * `m` names the suit page(s), `gpl` the Gunpla Wiki kit page and `man` the
 * Bandai manual page. The JAN is kept only when the row states it, it passes the
 * EAN-13 check digit and carries a Bandai prefix.
 */

export type MerchRow = {
  number?: number;
  title: string;
  jan?: string;
  releaseDate?: string;
  yen?: number;
  series?: string;
  /** suit pages, primary first */
  suitPages: string[];
  /** Gunpla Wiki kit page title */
  gunplaWiki?: string;
  /** manual.bandai-hobby.net/menus/detail/<id> */
  manualId?: string;
  note?: string;
};

export const MANUAL_ID = /manual\.bandai-hobby\.net\/menus\/detail\/(\d+)/;

/** Bandai JAN prefixes (4573102 / 4543112 / 49…). */
export const bandaiJan = (code: string) => validJan(code) && /^4[59]/.test(code);

/** Every {{merch}} block's raw fields, in page order. */
export function merchBlocks(wikitext: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const re = /\{\{\s*merch\s*\n?\|/gi;
  for (let m = re.exec(wikitext); m; m = re.exec(wikitext)) {
    let depth = 0;
    let end = m.index;
    for (; end < wikitext.length - 1; end++) {
      if (wikitext.startsWith("{{", end)) (depth++, end++);
      else if (wikitext.startsWith("}}", end)) {
        depth--;
        end++;
        if (depth === 0) break;
      }
    }
    const fields: Record<string, string> = {};
    for (const part of splitTop(wikitext.slice(m.index + 2, end - 1), "|").slice(1)) {
      const eq = part.indexOf("=");
      if (eq > 0) fields[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
    }
    out.push(fields);
    re.lastIndex = end;
  }
  return out;
}

/** `dt` is ISO ("2022-08-06") on newer rows, prose ("February 2004") on older ones. */
function merchDate(text: string): string | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  return iso && +iso[2] <= 12 && +iso[3] <= 31 ? iso[0] : exactDate(text);
}

export function parseMerch(wikitext: string): MerchRow[] {
  return merchBlocks(wikitext).flatMap((f) => {
    const title = f.title ? cleanCell(f.title).text : "";
    if (!title) return [];
    // `id=JAN 4573102629449`; ISBNs and other id kinds are not JANs.
    const janRaw = /^\s*JAN\b/i.test(f.id ?? "") ? (f.id ?? "").replace(/\D/g, "") : "";
    const yen = f.yen && /^\s*[\d,]+\s*$/.test(f.yen) ? Number(f.yen.replace(/\D/g, "")) : undefined;
    return [
      {
        number: f.number && /^\s*\d+\s*$/.test(f.number) ? Number(f.number) : undefined,
        title,
        jan: bandaiJan(janRaw) ? janRaw : undefined,
        releaseDate: f.dt ? merchDate(cleanCell(f.dt).text) : undefined,
        yen: yen && yen >= 200 ? yen : undefined,
        series: f.s ? cleanCell(f.s).text : undefined,
        suitPages: (f.m ?? "").split(",").map((t) => cleanCell(t).text).filter(Boolean),
        gunplaWiki: f.gpl ? cleanCell(f.gpl).text : undefined,
        manualId: MANUAL_ID.exec(f.man ?? "")?.[1],
        note: f.note ? cleanCell(f.note).text : undefined,
      },
    ];
  });
}
