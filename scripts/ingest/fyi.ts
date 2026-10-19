import type { Grade, SourceRef } from "../../lib/schema";
import { fetchText } from "./http";

/*
 * gunpla.fyi publishes a product index built from Bandai's instruction-manual
 * site (ids are manual.bandai-hobby.net page ids). It ships as a JSON literal
 * inside the site's JS bundle. We read that literal as text and decode its
 * escapes ourselves; nothing from the site is ever executed. Only factual
 * fields are kept (names, item code, date); box-art images are not copied.
 */

const ORIGIN = "https://gunpla.fyi";

export type FyiProduct = {
  id: string;
  nameJp: string;
  nameEn: string;
  partNo?: string;
  releaseDate?: string;
  brand: string;
  series: string;
};

const MARKER = 'JSON.parse(`[{"id"';

/** Decode a JS template literal's escapes as plain text (refuses ${} interpolation). */
function decodeTemplateLiteral(src: string, start: number): string {
  let out = "";
  for (let i = start; i < src.length; ) {
    const c = src[i];
    if (c === "`") return out;
    if (c === "$" && src[i + 1] === "{") throw new Error("template interpolation found; refusing to decode");
    if (c === "\\") {
      const n = src[i + 1];
      if (n === "u") {
        out += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16));
        i += 6;
      } else {
        out += n === "n" ? "\n" : n === "t" ? "\t" : n === "r" ? "\r" : n;
        i += 2;
      }
      continue;
    }
    out += c;
    i++;
  }
  throw new Error("unterminated template literal");
}

export async function loadFyi(refresh = false): Promise<{ products: FyiProduct[]; ref: SourceRef }> {
  const html = await fetchText("gunpla-fyi", `${ORIGIN}/?grade=MG`, refresh);
  const appPath = /\/_app\/immutable\/entry\/app\.[\w-]+\.js/.exec(html.body)?.[0];
  if (!appPath) throw new Error("gunpla.fyi: app entry not found");
  const app = await fetchText("gunpla-fyi", ORIGIN + appPath, refresh);
  const nodes = [...app.body.matchAll(/nodes\/(\d+\.[\w-]+\.js)/g)].map((m) => `/_app/immutable/nodes/${m[1]}`);
  for (const node of nodes) {
    const js = await fetchText("gunpla-fyi", ORIGIN + node, refresh);
    const at = js.body.indexOf(MARKER);
    if (at < 0) continue;
    const products = JSON.parse(decodeTemplateLiteral(js.body, at + MARKER.indexOf("["))) as FyiProduct[];
    return {
      products,
      ref: { name: "gunpla-fyi", title: `product index (${node.split("/").pop()})`, url: ORIGIN, revid: 0, license: "factual data; no license stated", fetchedAt: js.fetchedAt },
    };
  }
  throw new Error("gunpla.fyi: product list not found in any route bundle");
}

/** gunpla.fyi brand → our grade; non-Gundam lines (30MM, Pokémon, Figure-rise…) map to undefined. */
export function fyiGrade(brand: string): Grade | undefined {
  const b = brand.toUpperCase();
  if (b === "HG" || b === "HGUC" || b.startsWith("HG")) return "HG";
  if (b === "MGEX" || b === "MG") return "MG";
  if (b === "MGSD") return "MGSD";
  if (b === "RG") return "RG";
  if (b === "PG") return "PG";
  if (b === "ENTRY GRADE") return "EG";
  if (b === "RE/100") return "RE100";
  if (b === "FULL MECHANICS") return "FM";
  if (b.startsWith("SD")) return "SD";
  if (brand === "メガサイズモデル") return "MEGA";
  return undefined;
}

const STOP = new Set(["HG", "HGUC", "HGCE", "HGAC", "HGBF", "HGBD", "HGIBO", "MG", "MGEX", "MGSD", "RG", "PG", "RE", "100", "144", "60", "48", "1", "VER", "THE", "OF", "AND", "GUNDAM", "ENTRY", "GRADE", "FULL", "MECHANICS", "SD", "EX", "STANDARD", "UNLEASHED"]);

/** Comparable name tokens: drops grade/scale words, keeps model numbers and names. */
export function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toUpperCase()
      .normalize("NFKC")
      .replace(/[^A-Z0-9Ζ.\- ]+/g, " ")
      .replace(/\b(\d+)\/(\d+)\b/g, " ")
      .split(/[\s]+/)
      .map((t) => t.replace(/^[.\-]+|[.\-]+$/g, "").replace(/[-.]/g, ""))
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
