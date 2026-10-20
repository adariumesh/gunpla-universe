import { GRADE_ROWS, type GradeRow } from "@/lib/labels";
import type { EraMatrix, SuitColumn, TileCard } from "@/lib/repo";

export type Filters = {
  rows: Set<GradeRow>;
  /** only kits whose source-listed materials exclude ABS (unknown materials are hidden) */
  noAbs: boolean;
  /** include recolors, clear/metallic and limited editions */
  variants: boolean;
  /** only kits with a source-published JAN */
  withJan: boolean;
};

export type SortKey = "canon" | "kits" | "model";

export const defaultFilters = (): Filters => ({
  rows: new Set(GRADE_ROWS),
  noAbs: false,
  variants: false,
  withJan: false,
});

export function passes(card: TileCard, f: Filters) {
  if (f.noAbs && card.mold.specs.absJoints !== false) return false;
  if (!f.variants && card.sku.edition !== "standard") return false;
  if (f.withJan && !card.sku.jan) return false;
  return true;
}

export type VisibleColumn = SuitColumn & {
  cellsFiltered: Record<GradeRow, TileCard[]>;
  parentId?: string;
  hiddenVariants: number;
};

export type VisibleBand = { faction: string; columns: VisibleColumn[] };

/**
 * Applies variant disclosure, sort and filters to the era matrix. Sorting
 * moves parent+variant groups together so variants always sit beside their parent.
 */
export function visibleBands(
  m: EraMatrix,
  f: Filters,
  sort: SortKey,
  expandedParents: Set<string>,
): VisibleBand[] {
  return m.factions.map((band) => {
    const groups: SuitColumn[][] = [];
    for (const col of band.columns) {
      const isNestedVariant = band.columns.some((p) => p.variantIds.includes(col.suit.id));
      if (isNestedVariant) groups[groups.length - 1].push(col);
      else groups.push([col]);
    }

    const roleRank = { debut: 0, main: 1, cameo: 2 } as const;
    const key = (g: SuitColumn[]) => g[0];
    if (sort === "kits")
      groups.sort((a, b) => roleRank[key(a).role] - roleRank[key(b).role] || key(b).kitCount - key(a).kitCount);
    if (sort === "model")
      groups.sort((a, b) => roleRank[key(a).role] - roleRank[key(b).role] || key(a).suit.modelNumber.localeCompare(key(b).suit.modelNumber));

    const columns: VisibleColumn[] = [];
    for (const [parent, ...variants] of groups) {
      const hidden = variants.filter((v) => v.collapsedByDefault && !expandedParents.has(parent.suit.id));
      columns.push({ ...parent, cellsFiltered: filterCells(parent, f), hiddenVariants: hidden.length });
      for (const v of variants) {
        if (hidden.includes(v)) continue;
        columns.push({ ...v, cellsFiltered: filterCells(v, f), parentId: parent.suit.id, hiddenVariants: 0 });
      }
    }
    return { faction: band.faction, columns };
  });
}

function filterCells(col: SuitColumn, f: Filters) {
  return Object.fromEntries(GRADE_ROWS.map((r) => [r, col.cells[r].filter((c) => passes(c, f))])) as Record<GradeRow, TileCard[]>;
}
