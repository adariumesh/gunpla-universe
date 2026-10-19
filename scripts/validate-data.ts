import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db, integrityErrors } from "../lib/data";
import { validJan } from "./ingest/gunplawiki";
import { merchBlocks } from "./ingest/merch";

// Importing lib/data runs the zod parse; reaching this line means the schema passed.
const errs = integrityErrors();
const withJan = db.skus.filter((k) => k.jan);

console.log(
  `timelines ${db.timelines.length} · eras ${db.eras.length} (${db.eras.filter((e) => e.available).length} open) · suits ${db.suits.length} · molds ${db.molds.length} · skus ${db.skus.length}`,
);
console.log(`SKUs with a source-published JAN: ${withJan.length}/${db.skus.length}`);

// ── JAN audit: no fabricated barcodes ─────────────────────────────
for (const k of withJan) if (!validJan(k.jan!)) errs.push(`sku ${k.id}: JAN ${k.jan} fails the EAN-13 check digit`);
const seen = new Map<string, string>();
for (const k of withJan) {
  if (seen.has(k.jan!)) errs.push(`JAN ${k.jan} used by both ${seen.get(k.jan!)} and ${k.id}`);
  seen.set(k.jan!, k.id);
}

// Every JAN must appear verbatim in each source record it is attributed to: the Gunpla Wiki kit
// page's text, or exactly one {{merch}} entry (`id=JAN …`) on the Gundam Wiki list page.
const cacheRoot = join(process.cwd(), "data", "sources", "cache");
if (existsSync(join(cacheRoot, "gunpla-wiki"))) {
  const pageText = new Map<string, string>();
  for (const f of readdirSync(join(cacheRoot, "gunpla-wiki"))) {
    const body = JSON.parse(readFileSync(join(cacheRoot, "gunpla-wiki", f), "utf8")).body;
    for (const p of Object.values(body?.query?.pages ?? {}) as { title: string; revisions?: { slots: { main: { "*": string } } }[] }[])
      if (p.revisions) pageText.set(p.title, p.revisions[0].slots.main["*"].replace(/[\s-]/g, ""));
  }
  const merchJans = new Map<string, string[]>(); // list page title → JAN of each {{merch}} entry
  for (const f of existsSync(join(cacheRoot, "gundam-wiki")) ? readdirSync(join(cacheRoot, "gundam-wiki")) : []) {
    const parse = JSON.parse(readFileSync(join(cacheRoot, "gundam-wiki", f), "utf8")).body?.parse;
    if (parse?.wikitext) merchJans.set(parse.title, merchBlocks(parse.wikitext["*"]).map((b) => (/^\s*JAN\b/i.test(b.id ?? "") ? (b.id ?? "").replace(/\D/g, "") : "")));
  }
  let audited = 0;
  let sources = 0;
  for (const k of withJan) {
    const cited = (k.janSources ?? []).filter((r) => r.name === "gunpla-wiki" || r.name === "gundam-wiki");
    if (!cited.length) {
      errs.push(`sku ${k.id}: JAN ${k.jan} has no source citation`);
      continue;
    }
    let checked = false;
    for (const ref of cited) {
      if (ref.name === "gunpla-wiki") {
        const text = pageText.get(ref.title);
        if (text === undefined) continue; // snapshot not cached on this machine
        if (!text.includes(k.jan!)) errs.push(`sku ${k.id}: JAN ${k.jan} not found on cited page "${ref.title}"`);
      } else {
        const jans = merchJans.get(ref.title);
        if (jans === undefined) continue;
        const n = jans.filter((j) => j === k.jan).length;
        if (n !== 1) errs.push(`sku ${k.id}: JAN ${k.jan} is on ${n} {{merch}} entries of "${ref.title}" (expected exactly 1)`);
      }
      checked = true;
      sources++;
    }
    if (checked) audited++;
  }
  console.log(`JAN provenance audit: ${audited}/${withJan.length} checked against cached source records (${sources} citations)`);
} else {
  console.log("JAN provenance audit skipped: no source cache (run `npm run ingest -- --refresh`)");
}

if (errs.length) {
  console.error(`\n${errs.length} error(s):`);
  for (const e of errs.slice(0, 50)) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log("✓ schema, referential integrity and JAN audit OK");
