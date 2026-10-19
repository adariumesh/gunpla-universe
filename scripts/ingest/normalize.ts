import type { KitSKU } from "../../lib/schema";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** "1995 July" | "July 1995" | "1995" | "1995年7月" | "2010-07" → "1995-07" / "1995" */
export function parseReleaseDate(text: string): string | undefined {
  const t = text.trim();
  let m = /(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(t);
  if (m) return `${m[1]}-${pad(+m[2])}`;
  m = /(\d{4})[-/.](\d{1,2})/.exec(t);
  if (m && +m[2] <= 12) return `${m[1]}-${pad(+m[2])}`;
  m = /(\d{4})\s+([A-Za-z]+)/.exec(t);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[1]}-${pad(MONTHS[m[2].toLowerCase()])}`;
  m = /([A-Za-z]+)\.?\s+(?:\d{1,2},\s*)?(\d{4})/.exec(t);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[2]}-${pad(MONTHS[m[1].toLowerCase()])}`;
  m = /(19[5-9]\d|20\d\d)/.exec(t);
  return m ? m[1] : undefined;
}

/**
 * First yen amount in the cell. Sources mix pre-tax and tax-inclusive prices; we keep
 * the first listed. Amounts under ¥200 are lottery/overseas artefacts, not MSRPs.
 */
export function parseYen(text: string): number | undefined {
  const m = /[¥￥]\s*([\d,]+)|([\d,]+)\s*円/.exec(text);
  const n = m ? Number((m[1] ?? m[2]).replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n >= 200 ? n : undefined;
}

/** Version labels Gunpla collectors key on. */
export function parseVersion(text: string): string | undefined {
  const t = text.replace(/\s+/g, " ");
  const ver = /Ver(?:sion)?\.?\s*(Ka|\d+(?:\.\d+)?)\b/i.exec(t);
  if (ver) return /ka/i.test(ver[1]) ? "Ver.Ka" : `Ver.${ver[1].includes(".") ? ver[1] : `${ver[1]}.0`}`;
  if (/\brevive\b/i.test(t)) return "Revive";
  if (/\bunleashed\b/i.test(t)) return "Unleashed";
  if (/\bbeyond global\b/i.test(t)) return "Beyond Global";
  if (/\bG40\b/.test(t)) return "G40";
  if (/\bG30th\b/i.test(t)) return "G30th";
  if (/\bO\.?Y\.?W\.?\b|one year war 0079/i.test(t)) return "Ver.O.Y.W.";
  if (/the origin|GTO\b/i.test(t)) return "GTO";
  return undefined;
}

/**
 * Edition from the section heading and the kit name (not the notes, which mention
 * "clear parts" on ordinary kits). An unnumbered row inside a numbered line is a
 * variant release of a numbered kit.
 */
export function classifyEdition(section: string, name: string, numberedLine: boolean, hasNumber: boolean): KitSKU["edition"] {
  const s = `${section} ${name}`;
  if (/premium bandai|p-bandai|プレミアムバンダイ/i.test(s)) return "p-bandai";
  if (/gundam base|ガンダムベース/i.test(s)) return "gundam-base";
  if (/\bclear\b|クリア/i.test(name)) return "clear";
  if (/metallic|coating|plated|chrome|titanium|gold|extra finish|メッキ/i.test(name)) return "metallic";
  if (/limited|event|expo|exclusive|限定/i.test(section)) return "event-limited";
  if (/\blimited\b|\bexclusive\b|\bprize\b|\bexpo\b|\bevent\b|gundam docks|anniversary|special edition|\bpremium\b/i.test(name)) return "event-limited";
  if (/colou?r(?:ing)? ver|colou?r edition|\bcolou?r\]|recirculation|ecopla|ukiyo-e|livery/i.test(name)) return "recolor";
  if (numberedLine && !hasNumber) return "recolor";
  return "standard";
}

export const normModel = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Model-number candidates for a cell. The visible text wins: link targets often
 * point at a parent page's anchor (e.g. "Qubeley Mk-II" → [[AMX-004 Qubeley#…]]),
 * so links are only a fallback when the text has no model number.
 */
export function modelTokens(linkTargets: string[], text: string): string[] {
  const tok = (s: string) => (s.trim().split(/\s+/)[0] ?? "").split("/")[0].replace(/['‘’"]/g, "");
  const ok = (t: string) => /^[A-Za-z]{1,6}-?[A-Za-z0-9-]*\d[A-Za-z0-9-]*$/.test(t);
  const fromText = tok(text);
  if (ok(fromText)) return [normModel(fromText)];
  return [...new Set(linkTargets.map(tok).filter(ok).map(normModel))];
}
