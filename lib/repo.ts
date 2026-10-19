import { db, type Db } from "./data";
import type { Era, Faction, Grade, KitSKU, MobileSuit, Mold, TimelineNode } from "./schema";

export const GRADE_ROWS = ["VINTAGE", "HG", "RG", "MG", "PG", "EG", "OTHER"] as const;
export type GradeRow = (typeof GRADE_ROWS)[number];

export const GRADE_ROW_LABEL: Record<GradeRow, string> = {
  VINTAGE: "Vintage",
  HG: "HG / HGUC",
  RG: "Real Grade",
  MG: "Master Grade",
  PG: "Perfect Grade",
  EG: "Entry Grade",
  OTHER: "FG · SD · MEGA",
};

export function gradeRow(g: Grade): GradeRow {
  return (GRADE_ROWS as readonly string[]).includes(g) ? (g as GradeRow) : "OTHER";
}

// Heroes on the left, antagonists on the right.
const FACTION_ORDER: Faction[] = ["EFSF", "AEUG", "Londo Bell", "Titans", "Zeon", "Axis", "Neo Zeon"];

/** Only glyphs a source backs: materials/glue/paint from Gunpla Wiki, edition from the list tables. */
export type GlyphId = "abs" | "glue" | "paint" | "limited" | "jan";

export type KitCard = {
  sku: KitSKU;
  mold: Mold;
  year: number;
  /** release year of the mold's standard SKU; stacks sort on this so editions sit under their original */
  moldYear: number;
  row: GradeRow;
  /** null when no source lists a price */
  latestYen: number | null;
  glyphs: GlyphId[];
};

/**
 * What a matrix tile needs: a structural subset of KitCard. Era pages ship hundreds
 * of these, so notes and citations stay server-side (the drawer loads one full
 * KitCard at a time).
 */
export type TileCard = {
  sku: Pick<KitSKU, "id" | "name" | "edition" | "bandaiItemCode"> & { jan: string | null };
  mold: Pick<Mold, "id" | "grade" | "scale" | "line" | "versionLabel"> & {
    subjects: { suitId: string }[];
    specs: Pick<Mold["specs"], "absJoints" | "requiresGlue">;
  };
  year: number;
  moldYear: number;
  row: GradeRow;
  latestYen: number | null;
  glyphs: GlyphId[];
};

export function toTile(c: KitCard): TileCard {
  const { sku, mold } = c;
  return {
    sku: { id: sku.id, name: sku.name, edition: sku.edition, bandaiItemCode: sku.bandaiItemCode, jan: sku.jan },
    mold: {
      id: mold.id,
      grade: mold.grade,
      scale: mold.scale,
      line: mold.line,
      versionLabel: mold.versionLabel,
      subjects: [{ suitId: mold.subjects[0].suitId }],
      specs: { absJoints: mold.specs.absJoints, requiresGlue: mold.specs.requiresGlue },
    },
    year: c.year,
    moldYear: c.moldYear,
    row: c.row,
    latestYen: c.latestYen,
    glyphs: c.glyphs,
  };
}

export type SuitColumn = {
  suit: MobileSuit;
  role: "debut" | "main" | "cameo";
  /** ids of variant columns nested under this one (only on parents) */
  variantIds: string[];
  /** variants with low canon weight start collapsed under their parent */
  collapsedByDefault: boolean;
  cells: Record<GradeRow, TileCard[]>;
  kitCount: number;
  compact: boolean;
};

export type FactionBand = { faction: Faction; columns: SuitColumn[] };

export type EraMatrix = {
  era: Era;
  timeline: TimelineNode;
  stations: Era[];
  works: { id: string; title: string; releaseYear: number }[];
  factions: FactionBand[];
  yearRange: [number, number];
  kitCount: number;
};

const yearOf = (sku: KitSKU) => Number(sku.releaseDate.slice(0, 4));
const latestYen = (sku: KitSKU) => sku.msrpYen.at(-1)?.amount ?? null;

const LIMITED: KitSKU["edition"][] = ["p-bandai", "gundam-base", "event-limited"];

export function glyphsFor(sku: KitSKU, mold: Mold): GlyphId[] {
  const all: [boolean, GlyphId][] = [
    [mold.specs.absJoints === true, "abs"],
    [mold.specs.requiresGlue === true, "glue"],
    [mold.specs.needsPaint === true, "paint"],
    [LIMITED.includes(sku.edition), "limited"],
    [!!sku.jan, "jan"],
  ];
  return all.filter(([on]) => on).map(([, id]) => id);
}

function index(d: Db) {
  const moldById = new Map(d.molds.map((m) => [m.id, m]));
  const suitById = new Map(d.suits.map((s) => [s.id, s]));
  const eraById = new Map(d.eras.map((e) => [e.id, e]));
  const skusBySuit = new Map<string, KitSKU[]>();
  const moldYear = new Map<string, number>();
  for (const sku of d.skus) {
    if (sku.edition === "standard" || !moldYear.has(sku.moldId)) moldYear.set(sku.moldId, yearOf(sku));
    const mold = moldById.get(sku.moldId)!;
    const primary = mold.subjects.find((s) => s.role === "primary")!.suitId;
    if (!skusBySuit.has(primary)) skusBySuit.set(primary, []);
    skusBySuit.get(primary)!.push(sku);
  }
  return { moldById, suitById, eraById, skusBySuit, moldYear };
}

let cached: ReturnType<typeof index> | null = null;
const idx = (d: Db) => (d === db ? (cached ??= index(d)) : index(d));

export function toCard(sku: KitSKU, d: Db = db): KitCard {
  const { moldById, moldYear } = idx(d);
  const mold = moldById.get(sku.moldId)!;
  const yen = latestYen(sku);
  return {
    sku,
    mold,
    year: yearOf(sku),
    moldYear: moldYear.get(sku.moldId)!,
    row: gradeRow(mold.grade),
    latestYen: yen,
    glyphs: glyphsFor(sku, mold),
  };
}

export function getTimelines(d: Db = db) {
  return [...d.timelines].sort((a, b) => a.sortIndex - b.sortIndex);
}

export function getStations(timelineId: string, d: Db = db) {
  return d.eras.filter((e) => e.timelineId === timelineId);
}

export function getEra(eraId: string, d: Db = db) {
  return idx(d).eraById.get(eraId);
}

function emptyCells(): Record<GradeRow, TileCard[]> {
  return Object.fromEntries(GRADE_ROWS.map((r) => [r, []])) as unknown as Record<GradeRow, TileCard[]>;
}

export function getEraMatrix(eraId: string, d: Db = db): EraMatrix | null {
  const era = getEra(eraId, d);
  if (!era) return null;
  const { suitById, skusBySuit } = idx(d);
  const timeline = d.timelines.find((t) => t.id === era.timelineId)!;

  // One appearance per suit; debut/main beats cameo.
  const rank = { debut: 0, main: 1, cameo: 2 } as const;
  const roleBySuit = new Map<string, SuitColumn["role"]>();
  for (const a of d.appearances.filter((x) => x.eraId === eraId)) {
    const prev = roleBySuit.get(a.suitId);
    if (!prev || rank[a.role] < rank[prev]) roleBySuit.set(a.suitId, a.role);
  }

  const columns = new Map<string, SuitColumn>();
  for (const [suitId, role] of roleBySuit) {
    const suit = suitById.get(suitId)!;
    const cells = emptyCells();
    const cards = (skusBySuit.get(suitId) ?? []).map((k) => toTile(toCard(k, d)));
    for (const c of cards) cells[c.row].push(c);
    const editionRank = (c: TileCard) => (c.sku.edition === "standard" ? 0 : 1);
    for (const r of GRADE_ROWS)
      cells[r].sort(
        (a, b) => editionRank(a) - editionRank(b) || b.moldYear - a.moldYear || b.year - a.year || a.sku.id.localeCompare(b.sku.id),
      );
    columns.set(suitId, {
      suit,
      role,
      variantIds: [],
      collapsedByDefault: !!suit.variantOf && suit.canonWeight < 60,
      cells,
      kitCount: cards.length,
      compact: cards.length <= 2,
    });
  }

  // Nest variants under a parent present in this era.
  for (const col of columns.values()) {
    const parent = col.suit.variantOf && columns.get(col.suit.variantOf);
    if (parent) parent.variantIds.push(col.suit.id);
  }

  const byWeight = (a: SuitColumn, b: SuitColumn) =>
    rank[a.role] - rank[b.role] || b.suit.canonWeight - a.suit.canonWeight;

  const factions: FactionBand[] = [];
  // Known UC factions first (heroes left), then every other faction by kit count.
  const kitsByFaction = new Map<string, number>();
  for (const c of columns.values()) kitsByFaction.set(c.suit.faction, (kitsByFaction.get(c.suit.faction) ?? 0) + c.kitCount);
  const factionOrder = [
    ...FACTION_ORDER.filter((f) => kitsByFaction.has(f)),
    ...[...kitsByFaction.keys()].filter((f) => !FACTION_ORDER.includes(f)).sort((a, b) => kitsByFaction.get(b)! - kitsByFaction.get(a)! || a.localeCompare(b)),
  ];
  for (const faction of factionOrder) {
    const tops = [...columns.values()]
      .filter((c) => c.suit.faction === faction)
      .filter((c) => !(c.suit.variantOf && columns.has(c.suit.variantOf)))
      .sort(byWeight);
    if (!tops.length) continue;
    const ordered: SuitColumn[] = [];
    for (const top of tops) {
      ordered.push(top);
      const variants = top.variantIds.map((id) => columns.get(id)!).sort(byWeight);
      ordered.push(...variants);
    }
    factions.push({ faction, columns: ordered });
  }

  const years = factions.flatMap((f) => f.columns.flatMap((c) => GRADE_ROWS.flatMap((r) => c.cells[r].map((k) => k.year))));
  const workById = new Map(d.works.map((w) => [w.id, w]));

  return {
    era,
    timeline,
    stations: getStations(era.timelineId, d),
    works: era.workIds.map((id) => workById.get(id)!).map(({ id, title, releaseYear }) => ({ id, title, releaseYear })),
    factions,
    yearRange: years.length ? [Math.min(...years), Math.max(...years)] : [1980, 2026],
    kitCount: years.length,
  };
}

/** Kits per suit column for an era — feeds the L1 station sparklines. */
export function getEraDensity(eraId: string, d: Db = db): number[] {
  const m = getEraMatrix(eraId, d);
  if (!m) return [];
  return m.factions.flatMap((f) => f.columns.filter((c) => c.role !== "cameo").map((c) => c.kitCount));
}

export type KitDetail = {
  card: KitCard;
  suits: { suit: MobileSuit; role: string }[];
  primarySuit: MobileSuit;
  editions: KitCard[];
  lineage: KitCard[];
  eras: Era[];
};

/** Lineage uses each mold's standard SKU as its representative card. */
function representative(moldId: string, d: Db): KitCard | undefined {
  const sku = d.skus.find((k) => k.moldId === moldId && k.edition === "standard") ?? d.skus.find((k) => k.moldId === moldId);
  return sku && toCard(sku, d);
}

export function getKit(skuId: string, d: Db = db): KitDetail | null {
  const sku = d.skus.find((k) => k.id === skuId);
  if (!sku) return null;
  const { suitById, eraById } = idx(d);
  const card = toCard(sku, d);
  const mold = card.mold;
  const primaryId = mold.subjects.find((s) => s.role === "primary")!.suitId;
  const primarySuit = suitById.get(primaryId)!;

  const lineage = d.molds
    .filter((m) => m.subjects.some((s) => s.suitId === primaryId && s.role === "primary"))
    .map((m) => representative(m.id, d)!)
    .sort((a, b) => a.year - b.year || GRADE_ROWS.indexOf(a.row) - GRADE_ROWS.indexOf(b.row));

  const eraIds = new Set(d.appearances.filter((a) => a.suitId === primaryId).map((a) => a.eraId));

  return {
    card,
    suits: mold.subjects.map((s) => ({ suit: suitById.get(s.suitId)!, role: s.role })),
    primarySuit,
    editions: d.skus.filter((k) => k.moldId === mold.id && k.id !== sku.id).map((k) => toCard(k, d)),
    lineage,
    eras: [...eraIds].map((id) => eraById.get(id)!).filter(Boolean),
  };
}

export type SearchEntry = { kind: "suit" | "kit"; id: string; label: string; sub: string; href: string };

export function getSearchIndex(d: Db = db): SearchEntry[] {
  const { suitById, eraById } = idx(d);
  const suitsOut: SearchEntry[] = d.suits.map((s) => {
    const era = eraById.get(s.debutEraId)!;
    return { kind: "suit", id: s.id, label: `${s.modelNumber} ${s.name}`, sub: `${era.code} · ${era.label}`, href: `/era/${era.id}?focus=${s.id}` };
  });
  const kitsOut: SearchEntry[] = d.skus.map((k) => {
    const card = toCard(k, d);
    const suit = suitById.get(card.mold.subjects[0].suitId)!;
    return { kind: "kit", id: k.id, label: k.name, sub: `${suit.modelNumber} · ${card.year}${k.bandaiItemCode ? ` · #${k.bandaiItemCode}` : ""}${k.jan ? ` · ${k.jan}` : ""}`, href: `/kit/${k.id}` };
  });
  return [...suitsOut, ...kitsOut];
}
