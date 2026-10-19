import { z } from "zod";
import { eras, timelines, works } from "@/data/timelines";
import { suits } from "@/data/suits";
import { buildDataset } from "./ingested";
import { Era, KitSKU, MobileSuit, Mold, SuitAppearance, TimelineNode, Work } from "./schema";

const built = buildDataset(suits, eras);

/** Parsed, schema-validated dataset built from the open-data catalog. */
export const db = {
  timelines: z.array(TimelineNode).parse(timelines),
  eras: z.array(Era).parse(built.eras),
  works: z.array(Work).parse(works),
  suits: z.array(MobileSuit).parse(built.suits),
  appearances: z.array(SuitAppearance).parse(built.appearances),
  molds: z.array(Mold).parse(built.molds),
  skus: z.array(KitSKU).parse(built.skus),
};

export type Db = typeof db;

/** Referential-integrity problems; empty when the dataset is consistent. */
export function integrityErrors(d: Db = db): string[] {
  const errs: string[] = [];
  const ids = (xs: { id: string }[], kind: string) => {
    const set = new Set<string>();
    for (const x of xs) {
      if (set.has(x.id)) errs.push(`duplicate ${kind} id ${x.id}`);
      set.add(x.id);
    }
    return set;
  };
  const timelineIds = ids(d.timelines, "timeline");
  const eraIds = ids(d.eras, "era");
  const workIds = ids(d.works, "work");
  const suitIds = ids(d.suits, "suit");
  const moldIds = ids(d.molds, "mold");
  ids(d.skus, "sku");

  for (const e of d.eras) {
    if (!timelineIds.has(e.timelineId)) errs.push(`era ${e.id}: unknown timeline ${e.timelineId}`);
    for (const w of e.workIds) if (!workIds.has(w)) errs.push(`era ${e.id}: unknown work ${w}`);
  }
  for (const s of d.suits) {
    if (!eraIds.has(s.debutEraId)) errs.push(`suit ${s.id}: unknown debut era ${s.debutEraId}`);
    if (s.variantOf && !suitIds.has(s.variantOf)) errs.push(`suit ${s.id}: unknown parent ${s.variantOf}`);
    if (s.variantOf && !s.variantKind) errs.push(`suit ${s.id}: variantOf without variantKind`);
  }
  for (const a of d.appearances) {
    if (!suitIds.has(a.suitId)) errs.push(`appearance: unknown suit ${a.suitId}`);
    if (!eraIds.has(a.eraId)) errs.push(`appearance: unknown era ${a.eraId}`);
  }
  for (const m of d.molds) {
    for (const s of m.subjects) if (!suitIds.has(s.suitId)) errs.push(`mold ${m.id}: unknown suit ${s.suitId}`);
    if (!d.skus.some((k) => k.moldId === m.id)) errs.push(`mold ${m.id}: has no SKU`);
  }
  const jans = new Set<string>();
  for (const k of d.skus) {
    if (!moldIds.has(k.moldId)) errs.push(`sku ${k.id}: unknown mold ${k.moldId}`);
    if (k.jan) {
      if (jans.has(k.jan)) errs.push(`sku ${k.id}: duplicate JAN ${k.jan}`);
      jans.add(k.jan);
    }
  }
  return errs;
}
