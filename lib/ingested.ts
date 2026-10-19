import catalogJson from "@/data/generated/catalog.json";
import { Catalog, type Era, type Grade, type IngestedRelease, type KitSKU, type MobileSuit, type Mold, type Provenance, type SuitAppearance } from "./schema";

/*
 * Builds the shipped dataset from the open-data catalog (scripts/ingest →
 * data/generated/catalog.json). Nothing here is estimated or hand-entered:
 *   - suits: discovered from Gundam Wiki infoboxes; data/suits.ts adds only
 *     editorial grouping (variant links, ordering weight)
 *   - kits: every sourced release, keyed by Bandai item code, else JAN, else a
 *     stable source-derived id
 *   - specs: only what a Gunpla Wiki kit page states (materials, glue, paint)
 *   - JAN: only as published on a Gunpla Wiki kit page or a Gundam Wiki {{merch}}
 *     entry (check digit validated, disputed codes excluded upstream)
 */

export const catalog: Catalog = Catalog.parse(catalogJson);

export const GRADE_LABEL: Record<Grade, string> = {
  VINTAGE: "", HG: "HG", RG: "RG", MG: "MG", PG: "PG", EG: "ENTRY GRADE", FG: "FG", SD: "SD", MGSD: "MGSD",
  RE100: "RE/100", FM: "FULL MECHANICS", MEGA: "MEGA SIZE", OTHER: "",
};
const DEFAULT_SCALE: Record<Grade, Mold["scale"]> = {
  VINTAGE: "1/144", HG: "1/144", RG: "1/144", MG: "1/100", PG: "1/60", EG: "1/144", FG: "1/144", SD: "NS", MGSD: "NS",
  RE100: "1/100", FM: "1/100", MEGA: "1/48", OTHER: "1/144",
};
const MOLD_SCALES = new Set<Mold["scale"]>(["1/144", "1/100", "1/60", "1/48", "NS"]);

const itemCodeOf = (r: IngestedRelease) => (r.bandai && /^\d{5,8}$/.test(r.bandai.itemCode) ? r.bandai.itemCode : undefined);
const janOf = (r: IngestedRelease) => r.kitPage?.jan ?? r.merch?.jan;

/** Kit key: Bandai item code (preferred), then JAN, then the source-derived release id. */
export function kitKey(r: IngestedRelease): string {
  const code = itemCodeOf(r);
  if (code) return `bandai-${code}`;
  const jan = janOf(r);
  return jan ? `jan-${jan}` : r.id;
}

function releaseProvenance(r: IngestedRelease): Provenance {
  const agreeing = r.corroboration.filter((c) => c.agrees);
  const refs = [r.source, ...agreeing.map((c) => c.source)];
  if (r.kitPage && r.kitPage.source.url !== r.source.url) refs.push(r.kitPage.source);
  if (r.merch && r.merch.source.url !== r.source.url) refs.push(r.merch.source);
  if (r.bandai) refs.push(r.bandai.source);
  const fields = ["release date", ...(r.yen || r.kitPage?.yen ? ["list price"] : []), ...(janOf(r) ? ["JAN"] : []), ...(itemCodeOf(r) ? ["Bandai item code"] : [])];
  return { verifiedAt: r.source.fetchedAt.slice(0, 10), refs, fields };
}

/** Exact day from the kit page / product index when it agrees with the list table's month. */
function bestDate(r: IngestedRelease): string | undefined {
  const day = r.kitPage?.releaseDate ?? r.bandai?.releaseDate;
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day) && (!r.releaseDate || day.startsWith(r.releaseDate.slice(0, 7)))) return day;
  return r.releaseDate ?? (r.kitPage?.releaseDate || undefined);
}

function specsOf(r: IngestedRelease): { specs: Mold["specs"]; provenance: Provenance } {
  const k = r.kitPage;
  const fields: string[] = [];
  const specs: Mold["specs"] = { materials: [] };
  if (k?.materials.length) {
    specs.materials = k.materials;
    specs.absJoints = k.materials.includes("ABS");
    specs.kpsJoints = k.materials.includes("KPS");
    fields.push("materials");
  }
  if (k?.needsGlue !== undefined) {
    specs.requiresGlue = k.needsGlue;
    fields.push("glue");
  }
  if (k?.needsPaint !== undefined) {
    specs.needsPaint = k.needsPaint;
    fields.push("paint");
  }
  return {
    specs,
    provenance: { refs: fields.length && k ? [k.source] : [], fields },
  };
}

export function buildDataset(curatedSuits: MobileSuit[], eras: Era[], cat: Catalog = catalog) {
  // Suits are the discovered (sourced) records; curation only adds grouping.
  const curated = new Map(curatedSuits.map((s) => [s.id, s]));
  const suits: MobileSuit[] = cat.suits.map(({ source: _source, ...s }) => {
    const c = curated.get(s.id);
    return c ? { ...s, variantOf: c.variantOf, variantKind: c.variantKind, continuity: c.continuity, canonWeight: c.canonWeight } : s;
  });
  const suitIds = new Set(suits.map((s) => s.id));
  for (const s of suits) if (s.variantOf && !suitIds.has(s.variantOf)) (s.variantOf = undefined), (s.variantKind = undefined);
  const appearances: SuitAppearance[] = suits.map((s) => ({ suitId: s.id, eraId: s.debutEraId, role: "debut" as const }));

  const molds: Mold[] = [];
  const skus: KitSKU[] = [];
  const used = new Set<string>();
  for (const r of cat.releases) {
    if (!suitIds.has(r.suitId)) continue;
    const date = bestDate(r);
    if (!date) continue; // undated rows can't be placed
    let id = kitKey(r);
    if (used.has(id)) id = r.id; // a key already taken means two records claim it: keep both, unkeyed
    used.add(id);

    const { specs, provenance } = specsOf(r);
    molds.push({
      id,
      grade: r.grade,
      scale: MOLD_SCALES.has(r.scale as Mold["scale"]) ? (r.scale as Mold["scale"]) : DEFAULT_SCALE[r.grade],
      line: r.lineLabel,
      versionLabel: r.versionLabel,
      subjects: [{ suitId: r.suitId, role: "primary" }],
      specs,
      notes: r.notes,
      provenance,
    });

    const prefix = r.lineLabel ?? (r.grade === "VINTAGE" ? (r.scale ?? "") : GRADE_LABEL[r.grade]);
    const yen = r.yen ?? r.kitPage?.yen;
    skus.push({
      id,
      moldId: id,
      name: r.id.startsWith("kp-") ? r.name : `${prefix ? `${prefix} ` : ""}${r.name}`.trim(),
      jan: janOf(r) ?? null,
      janSources: [...(r.kitPage?.jan ? [r.kitPage.source] : []), ...(r.merch?.jan ? [r.merch.source] : [])],
      edition: r.edition,
      releaseDate: date,
      msrpYen: yen ? [{ amount: yen, effective: date }] : [],
      bandaiItemCode: itemCodeOf(r),
      manualUrl: r.bandai?.manualUrl,
      officialName: r.bandai?.nameEn || undefined,
      provenance: releaseProvenance(r),
    });
  }

  const kitSuits = new Set(molds.map((m) => m.subjects[0].suitId));
  const erasOut = eras.map((e) => ({ ...e, available: suits.some((s) => s.debutEraId === e.id && kitSuits.has(s.id)) }));
  return { suits, appearances, molds, skus, eras: erasOut };
}
