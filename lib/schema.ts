import { z } from "zod";

/*
 * Taxonomy:
 *   TimelineNode → Era (station) → Work
 *   MobileSuit ↔ Era via SuitAppearance (debut | main | cameo)
 *   MobileSuit ↔ Mold via Mold.subjects
 *   Mold (sourced specs) → KitSKU (retail release keyed by Bandai item code, then JAN)
 *
 * Sourced specs (materials, glue, paint) live on the Mold; price, JAN and item
 * code live on each SKU. Nothing is estimated: absent means no source says.
 */

export const TimelineId = z.enum([
  "UC", "RC", "FC", "AC", "AD00", "CE", "BUILD", "AW", "AG", "PD", "AS", "CC",
]);
export type TimelineId = z.infer<typeof TimelineId>;

export const Continuity = z.enum(["main", "origin", "thunderbolt", "alt"]);

export const SourceRef = z.object({
  name: z.enum(["gundam-wiki", "ja-wikipedia", "gunpla-fyi", "gunpla-wiki"]),
  title: z.string(),
  url: z.string().url(),
  revid: z.number().int(),
  license: z.string(),
  fetchedAt: z.string(),
});
export type SourceRef = z.infer<typeof SourceRef>;

/** Where a record's values come from. Every shipped value is cited; nothing is scored or estimated. */
export const Provenance = z.object({
  /** date the cited pages were fetched */
  verifiedAt: z.string().optional(),
  /** the source pages that state these values */
  refs: z.array(SourceRef).default([]),
  /** which fields the refs back, e.g. ["release date", "JAN"] or ["materials", "glue"] */
  fields: z.array(z.string()).default([]),
});
export type Provenance = z.infer<typeof Provenance>;

export const TimelineNode = z.object({
  id: TimelineId,
  name: string(),
  short: string(),
  colorToken: string(),
  sortIndex: z.number(),
  convergesInto: TimelineId.optional(),
  meta: z.boolean().default(false),
});
export type TimelineNode = z.infer<typeof TimelineNode>;

export const Era = z.object({
  id: string(),
  timelineId: TimelineId,
  code: string(), // "UC 0087"
  label: string(), // "Gryps Conflict"
  yearStart: z.number().nullable(),
  workIds: z.array(string()),
  available: z.boolean(), // has matrix data in this build
});
export type Era = z.infer<typeof Era>;

export const Work = z.object({
  id: string(),
  title: string(),
  medium: z.enum(["tv", "ova", "film", "manga", "game", "novel"]),
  releaseYear: z.number(),
  continuity: Continuity,
});
export type Work = z.infer<typeof Work>;

// Open set: discovered suits bring their own operators (Earth Alliance, Celestial Being, Tekkadan…).
export const Faction = z.string().min(1);
export type Faction = z.infer<typeof Faction>;

export const MobileSuit = z.object({
  id: string(),
  modelNumber: string(),
  name: string(),
  faction: Faction,
  pilot: string().optional(),
  variantOf: string().optional(),
  variantKind: z
    .enum(["production", "pilot-custom", "refit", "prototype-sibling", "continuity-reinterpretation"])
    .optional(),
  continuity: Continuity,
  debutEraId: string(),
  canonWeight: z.number().min(0).max(100),
  kanji: string().optional(),
  /** Gundam Wiki page the suit was discovered from */
  wikiTitle: string().optional(),
});
export type MobileSuit = z.infer<typeof MobileSuit>;

export const SuitAppearance = z.object({
  suitId: string(),
  eraId: string(),
  role: z.enum(["debut", "main", "cameo"]),
});
export type SuitAppearance = z.infer<typeof SuitAppearance>;

export const Grade = z.enum(["VINTAGE", "HG", "RG", "MG", "PG", "EG", "FG", "SD", "MGSD", "RE100", "FM", "MEGA", "OTHER"]);
export type Grade = z.infer<typeof Grade>;

/**
 * Kit facts that a source states (Gunpla Wiki Plamo Infobox). Every field is optional:
 * absent means "no source says", never a guess. Estimated scores were removed by design.
 */
export const Specs = z.object({
  materials: z.array(z.string()).default([]), // e.g. ["PS", "PE", "ABS"]
  absJoints: z.boolean().optional(),
  kpsJoints: z.boolean().optional(),
  requiresGlue: z.boolean().optional(),
  needsPaint: z.boolean().optional(),
});
export type Specs = z.infer<typeof Specs>;

export const Mold = z.object({
  id: string(),
  grade: Grade,
  scale: z.enum(["1/144", "1/100", "1/60", "1/48", "NS"]),
  line: string().optional(), // "HGUC 041", "RG 10"
  versionLabel: string().optional(), // "Ver.2.0", "Ver.Ka", "Revive"
  subjects: z.array(z.object({ suitId: string(), role: z.enum(["primary", "included", "bonus"]) })).min(1),
  specs: Specs,
  /** source-written notes (Gundam Wiki list tables), quoted with attribution */
  notes: string().optional(),
  provenance: Provenance,
});
export type Mold = z.infer<typeof Mold>;

export const KitSKU = z.object({
  id: string(),
  moldId: string(),
  name: string(),
  jan: z.string().regex(/^\d{13}$/).nullable(),
  edition: z.enum([
    "standard", "reissue", "clear", "metallic", "event-limited", "gundam-base", "p-bandai", "recolor",
  ]),
  releaseDate: z.string().regex(/^\d{4}(-\d{2})?(-\d{2})?$/),
  // Empty when no source lists a price.
  msrpYen: z.array(z.object({ amount: z.number().int().positive(), effective: string() })),
  /** Bandai's 7-digit item code (printed above the barcode); not the JAN */
  bandaiItemCode: z.string().regex(/^\d{5,8}$/).optional(),
  /** official instruction-manual page */
  manualUrl: z.string().url().optional(),
  /** Bandai's official English product name (product index), used for retailer search links */
  officialName: z.string().optional(),
  /** the source records that state `jan` verbatim (audited by validate:data) */
  janSources: z.array(SourceRef).optional(),
  provenance: Provenance,
});
export type KitSKU = z.infer<typeof KitSKU>;


function string() {
  return z.string().min(1);
}

/* ── Ingested open-data records (scripts/ingest → data/generated) ─────────── */


export const IngestedRelease = z.object({
  id: z.string().min(1),
  suitId: z.string().min(1),
  grade: Grade,
  scale: z.string().optional(),
  lineLabel: z.string().optional(), // "MG 001", "HGUC 191"
  name: z.string().min(1),
  versionLabel: z.string().optional(),
  edition: KitSKU.shape.edition,
  releaseDate: z.string().regex(/^\d{4}(-\d{2}){0,2}$/).optional(),
  yen: z.number().int().positive().optional(),
  notes: z.string().optional(),
  section: z.string(),
  extras: z.record(z.string(), z.string()).default({}),
  source: SourceRef,
  /** independent sources that agree / disagree on the release date */
  corroboration: z
    .array(z.object({ source: SourceRef, releaseDate: z.string().optional(), agrees: z.boolean() }))
    .default([]),
  /** per-kit page on Gunpla Wiki: JAN, materials, glue/paint */
  kitPage: z
    .object({
      source: SourceRef,
      jan: z.string().regex(/^\d{13}$/).optional(),
      releaseDate: z.string().optional(),
      yen: z.number().int().optional(),
      materials: z.array(z.string()),
      needsGlue: z.boolean().optional(),
      needsPaint: z.boolean().optional(),
    })
    .optional(),
  /** {{merch}} entry on a Gundam Wiki list page: JAN, manual id, Gunpla Wiki page link */
  merch: z
    .object({
      source: SourceRef,
      title: z.string(),
      number: z.number().int().optional(),
      jan: z.string().regex(/^\d{13}$/).optional(),
      manualId: z.string().optional(),
      gunplaWiki: z.string().optional(),
    })
    .optional(),
  /** product-index match (gunpla.fyi, built from Bandai's manual site) */
  bandai: z
    .object({
      itemCode: z.string(),
      nameEn: z.string(),
      nameJp: z.string(),
      releaseDate: z.string(),
      manualUrl: z.string().url(),
      source: SourceRef,
    })
    .optional(),
});
export type IngestedRelease = z.infer<typeof IngestedRelease>;

export const DiscoveredSuit = MobileSuit.extend({ source: SourceRef });
export type DiscoveredSuit = z.infer<typeof DiscoveredSuit>;

/** Primary-key table: every source-published JAN, attached to a release only when unambiguous. */
export const JanRecord = z.object({
  jan: z.string().regex(/^\d{13}$/),
  title: z.string(),
  grade: Grade.optional(),
  classification: z.string(),
  releaseDate: z.string().optional(),
  suitId: z.string().optional(),
  releaseId: z.string().optional(),
  status: z.enum(["attached", "standalone", "no-suit", "no-date", "ambiguous", "disputed"]),
  /** other records publishing the same JAN, or the same kit's record publishing another JAN (status "disputed") */
  conflictsWith: z.array(z.string()).default([]),
  source: SourceRef,
});
export type JanRecord = z.infer<typeof JanRecord>;

export const Catalog = z.object({
  generatedAt: z.string(),
  suits: z.array(DiscoveredSuit),
  releases: z.array(IngestedRelease),
  jans: z.array(JanRecord),
});
export type Catalog = z.infer<typeof Catalog>;
