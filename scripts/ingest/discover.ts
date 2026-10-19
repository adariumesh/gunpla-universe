import type { Era, SourceRef, TimelineId } from "../../lib/schema";
import { fetchJson } from "./http";
import { cleanCell } from "./wikitext";

/*
 * Suit discovery: the kit tables link each kit to its mobile-suit page. Those
 * pages carry an Infobox/Mobile Weapon with the timeline (`era`), in-universe
 * debut date (`first`), operators and pilots — enough to place every suit on
 * the transit map without hand entry.
 */

const API = "https://gundam.fandom.com/api.php";
const BASE = "https://gundam.fandom.com/wiki/";

export type Infobox = {
  title: string;
  revid: number;
  fetchedAt: string;
  english?: string;
  kanji?: string;
  era?: string;
  first?: string;
  operator?: string;
  pilot?: string;
};

type QueryResponse = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages: Record<string, { title: string; missing?: string; revisions?: { revid: number; slots: { main: { "*": string } } }[] }>;
  };
};

function parseInfobox(wikitext: string): Record<string, string> | undefined {
  const start = wikitext.search(/\{\{\s*Infobox\/Mobile Weapon/i);
  if (start < 0) return undefined;
  const fields: Record<string, string> = {};
  let key: string | undefined;
  let depth = 0;
  for (const line of wikitext.slice(start).split("\n").slice(1)) {
    if (depth === 0 && /^\s*\}\}\s*$/.test(line)) break;
    const m = depth === 0 ? /^\s*\|\s*([A-Za-z]+)\s*=(.*)$/.exec(line) : null;
    if (m) {
      key = m[1];
      fields[key] = m[2];
    } else if (key) fields[key] += `\n${line}`;
    depth += (line.match(/\{\{/g)?.length ?? 0) - (line.match(/\}\}/g)?.length ?? 0);
    if (depth < 0) break;
  }
  return fields;
}

/** First list item of an infobox value, without refs, links or "~note" suffixes. */
export function firstItem(v?: string): string | undefined {
  if (!v) return undefined;
  const cleaned = cleanCell(v.replace(/\[ref:[^\]]*\]/g, "").replace(/\[[A-Z][A-Za-z0-9 ]{1,12}\]/g, "")).text;
  const first = cleaned.split(/[,;\n]|\*/).map((x) => x.replace(/~.*$/, "").trim()).find(Boolean);
  return first || undefined;
}

/**
 * Infobox operators are chronological and qualify side contexts with "~"
 * ("Gjallarhorn~Calamity War, Tekkadan"). The first unqualified operator is the
 * suit's principal operator; fall back to the first listed.
 */
export function primaryOperator(v?: string): string | undefined {
  if (!v) return undefined;
  const cleaned = v.replace(/\[ref:[^\]]*\]/g, "").replace(/\[[A-Z][A-Za-z0-9 ]{1,12}\]/g, "");
  const items = cleaned.split(/[,;\n]|\*/).map((x) => x.trim()).filter(Boolean);
  const pick = items.find((x) => !x.includes("~")) ?? items[0];
  return pick ? cleanCell(pick.replace(/~.*$/, "")).text || undefined : undefined;
}

export async function fetchInfoboxes(titles: string[], refresh = false): Promise<Map<string, Infobox>> {
  const out = new Map<string, Infobox>();
  const unique = [...new Set(titles)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = `${API}?action=query&format=json&redirects=1&prop=revisions&rvprop=ids%7Ccontent&rvslots=main&titles=${encodeURIComponent(batch.join("|"))}`;
    const snap = await fetchJson<QueryResponse>("gundam-wiki", url, refresh);
    const q = snap.body.query;
    if (!q) continue;
    const resolve = new Map<string, string>();
    for (const t of batch) resolve.set(t, t);
    for (const n of q.normalized ?? []) for (const [k, v] of resolve) if (v === n.from) resolve.set(k, n.to);
    for (const r of q.redirects ?? []) for (const [k, v] of resolve) if (v === r.from) resolve.set(k, r.to);
    const byTitle = new Map(Object.values(q.pages).map((p) => [p.title, p]));
    for (const [asked, final] of resolve) {
      const page = byTitle.get(final);
      const rev = page?.revisions?.[0];
      if (!page || !rev) continue;
      const box = parseInfobox(rev.slots.main["*"]);
      if (!box) continue;
      out.set(asked, {
        title: page.title,
        revid: rev.revid,
        fetchedAt: snap.fetchedAt,
        english: firstItem(box.english),
        kanji: firstItem(box.kanji),
        era: firstItem(box.era),
        first: box.first ? cleanCell(box.first.replace(/\[ref:[^\]]*\]/g, "")).text : undefined,
        operator: primaryOperator(box.operator),
        pilot: firstItem(box.pilot),
      });
    }
  }
  return out;
}

export const infoboxRef = (b: Infobox): SourceRef => ({
  name: "gundam-wiki",
  title: b.title,
  url: BASE + encodeURIComponent(b.title.replace(/ /g, "_")),
  revid: b.revid,
  license: "CC BY-SA 3.0",
  fetchedAt: b.fetchedAt,
});

const ERA_TIMELINE: [RegExp, TimelineId][] = [
  [/universal century/i, "UC"],
  [/regild/i, "RC"],
  [/future century/i, "FC"],
  [/after colony/i, "AC"],
  [/after war/i, "AW"],
  [/advanced generation/i, "AG"],
  [/cosmic era/i, "CE"],
  [/post disaster/i, "PD"],
  [/ad stella/i, "AS"],
  [/correct century/i, "CC"],
  [/build|gunpla battle|gbn|metaverse|breaker|real world/i, "BUILD"],
  [/anno domini/i, "AD00"],
];

export function timelineOf(era?: string): TimelineId | undefined {
  return era ? ERA_TIMELINE.find(([re]) => re.test(era))?.[1] : undefined;
}

/** Last number in the debut field: "July, 0087" → 87, "January 25, 71" → 71, "AD 2307" → 2307. */
export function debutYear(first?: string): number | undefined {
  const nums = first?.match(/\d{1,4}/g);
  return nums?.length ? Number(nums[nums.length - 1]) : undefined;
}

/** The latest station on the timeline at or before the debut year (or the first station). */
export function stationFor(timeline: TimelineId, year: number | undefined, eras: Era[]): Era | undefined {
  const stations = eras.filter((e) => e.timelineId === timeline && e.yearStart !== null).sort((a, b) => a.yearStart! - b.yearStart!);
  if (!stations.length) return eras.find((e) => e.timelineId === timeline);
  if (year === undefined) return stations[0];
  return [...stations].reverse().find((e) => e.yearStart! <= year) ?? stations[0];
}
