"use client";

import { Check, GitCompareArrows, Minus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GradeChip, MockBadge } from "@/components/Glyph";
import { ArtPlate } from "@/components/matrix/KitTile";
import type { KitDetail, LineageCard } from "@/lib/repo";
import { RetailerLinks } from "./RetailerLinks";

const yen = (n: number | null) => (n === null ? "—" : `¥${n.toLocaleString("en-US")}`);
const SOURCE_LABEL: Record<string, string> = {
  "gundam-wiki": "Gundam Wiki",
  "gunpla-wiki": "Gunpla Wiki",
  "ja-wikipedia": "Wikipedia (ja)",
  "gunpla-fyi": "gunpla.fyi (Bandai manual index)",
};

/** Kit detail: only facts a cited source states. Absent fields say so instead of guessing. */
export function KitDetailView({ detail, asDrawer = false }: { detail: KitDetail; asDrawer?: boolean }) {
  const kitHref = (id: string) => (asDrawer ? { query: { kit: id } } : `/kit/${id}/`);
  const { card, primarySuit } = detail;
  const { sku, mold } = card;
  const specs = mold.specs;
  const [compareId, setCompareId] = useState<string | null>(null);
  const compare = detail.lineage.find((c) => c.mold.id === compareId);
  const hasSpecs = mold.provenance.fields.length > 0;
  const refs = [...sku.provenance.refs, ...(sku.janSources ?? []), ...mold.provenance.refs].filter((r, i, all) => all.findIndex((x) => x.url === r.url) === i);

  return (
    <article className="pb-10">
      <header className="border-b border-rule px-5 pb-5 pt-5">
        <div className="flex items-center gap-2 pr-10">
          <span className="rounded-sm border border-rule px-1 font-mono text-[10px] uppercase tracking-widest text-ink-3">Sheet 3 of 3</span>
          <GradeChip grade={mold.grade} />
          <span className="font-mono text-xs text-ink-3">
            {mold.scale}
            {mold.line ? ` · ${mold.line}` : ""}
          </span>
          <MockBadge className="ml-auto" />
        </div>
        <h2 className="mt-2 font-display text-3xl font-bold leading-tight">{sku.name}</h2>
        {sku.officialName && sku.officialName.toLowerCase() !== sku.name.toLowerCase() && (
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-ink-3">Bandai: {sku.officialName}</p>
        )}
        <p className="mt-1 text-sm text-ink-2">
          {detail.suits.map(({ suit, role }, i) => (
            <span key={suit.id}>
              {i > 0 && " + "}
              <Link href={`/era/${suit.debutEraId}?focus=${suit.id}`} className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                {suit.modelNumber} {suit.name}
              </Link>
              {role !== "primary" && <span className="text-ink-3"> ({role})</span>}
            </span>
          ))}
          {detail.eras.length > 0 && <span className="text-ink-3"> · {detail.eras.map((x) => x.code).join(", ")}</span>}
        </p>
        <div className="mt-4">
          <ArtPlate card={card} big />
        </div>
      </header>

      <Section title="Identity" index="01">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="Bandai item code">
            {sku.bandaiItemCode ? <span className="font-mono">{sku.bandaiItemCode}</span> : <Missing />}
            {sku.manualUrl && (
              <a href={sku.manualUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs underline decoration-rule underline-offset-4 hover:decoration-ink">
                official manual ↗
              </a>
            )}
          </Field>
          <Field label="JAN (13-digit)">
            {sku.jan ? (
              <span className="font-mono">
                {sku.jan}
                <span className="ml-1.5 font-sans text-[10px] text-ok" title="Published on the cited source page; EAN-13 check digit verified">
                  sourced ✓
                </span>
              </span>
            ) : (
              <Missing />
            )}
          </Field>
          <Field label="Released">{sku.releaseDate}</Field>
          <Field label="Edition">{sku.edition.replace("-", " ")}</Field>
          <Field label="Bandai list price">
            {sku.msrpYen.length ? (
              sku.msrpYen.map((p, i) => (
                <span key={p.effective} className={i < sku.msrpYen.length - 1 ? "mr-2 text-ink-3 line-through" : "font-medium"}>
                  {yen(p.amount)}
                </span>
              ))
            ) : (
              <Missing />
            )}
          </Field>
          <Field label="Kit key" verbatim>
            <span className="font-mono text-xs">{sku.id}</span>
          </Field>
        </dl>
        {detail.editions.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-ink-3">Other releases of this mold</p>
            <ul className="space-y-1 text-sm">
              {detail.editions.map((ed) => (
                <li key={ed.sku.id}>
                  <Link href={kitHref(ed.sku.id)} replace scroll={false} className="hover:underline">
                    {ed.sku.name}
                  </Link>{" "}
                  <span className="font-mono text-[11px] text-ink-3">
                    {ed.year} · {yen(ed.latestYen)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Specs" index="02">
        {hasSpecs ? (
          <>
            <ul className="flex flex-wrap gap-1.5">
              {specs.materials.map((m) => (
                <li key={m} className="rounded-full border border-rule px-2 py-0.5 font-mono text-xs">
                  {m}
                </li>
              ))}
              {specs.requiresGlue !== undefined && <Fact good={!specs.requiresGlue} label={specs.requiresGlue ? "Glue required" : "Snap-fit, no glue"} />}
              {specs.needsPaint !== undefined && <Fact good={!specs.needsPaint} label={specs.needsPaint ? "Source says painting needed" : "No painting needed"} />}
            </ul>
            {specs.absJoints && (
              <p className="mt-3 flex items-start gap-2 text-sm text-warn">
                <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
                Lists ABS among its plastics. ABS parts can crack with solvent-based panel liners.
              </p>
            )}
            <p className="mt-3 font-mono text-[10px] text-ink-3">Sourced: {mold.provenance.fields.join(", ")} (Gunpla Wiki).</p>
          </>
        ) : (
          <p className="text-sm text-ink-3">No source lists materials, glue or paint for this kit yet.</p>
        )}
      </Section>

      {mold.notes && (
        <Section title="Notes from the source" index="03">
          <blockquote className="border-l-2 border-accent pl-3 text-sm text-ink-2">{mold.notes}</blockquote>
          <p className="mt-2 font-mono text-[10px] text-ink-3">Quoted from Gundam Wiki (CC BY-SA 3.0).</p>
        </Section>
      )}

      <Section title={`Every ${primarySuit.name} kit`} index="04">
        <LineageStrip lineage={detail.lineage} current={card} compareId={compareId} onCompare={setCompareId} kitHref={kitHref} />
        {detail.lineageTotal > detail.lineage.length && (
          <p className="mt-2 font-mono text-[10px] text-ink-3">
            Showing {detail.lineage.length} of {detail.lineageTotal} kits nearest this release ·{" "}
            <Link href={`/era/${primarySuit.debutEraId}?focus=${primarySuit.id}`} className="underline underline-offset-2">
              see all in the era grid
            </Link>
          </p>
        )}
        {compare && <CompareTable a={card} b={compare} onClose={() => setCompareId(null)} />}
      </Section>

      <Section title="Where to buy" index="05">
        <RetailerLinks jan={sku.jan} itemCode={sku.bandaiItemCode} grade={mold.grade} modelNumber={primarySuit.modelNumber} suitName={primarySuit.name} />
      </Section>

      <Section title="Sources & provenance" index="06">
        <p className="text-sm text-ink-2">{sku.provenance.fields.join(", ")} cited from:</p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {refs.map((r) => (
            <li key={r.url} className="flex flex-wrap items-baseline gap-x-2">
              <a href={r.url} target="_blank" rel="noreferrer" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                {SOURCE_LABEL[r.name]}: {r.title}
              </a>
              <span className="font-mono text-[10px] text-ink-3">
                {r.revid ? `rev ${r.revid} · ` : ""}
                {r.license}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-mono text-[10px] text-ink-3">
          Fetched {sku.provenance.verifiedAt} · list prices as recorded by the source (tax treatment varies) ·{" "}
          <Link href="/credits" className="underline underline-offset-2">
            all credits
          </Link>
        </p>
      </Section>
    </article>
  );
}

function Missing() {
  return <span className="text-ink-3">not published by any source yet</span>;
}

function Fact({ good, label }: { good: boolean; label: string }) {
  return (
    <li className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${good ? "border-ok/40" : "border-warn/50 text-warn"}`}>
      {good ? <Check size={11} className="text-ok" /> : <Minus size={11} />}
      {label}
    </li>
  );
}

function Section({ title, index, children }: { title: string; index: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-rule px-5 py-5">
      <h3 className="mb-3 flex items-baseline gap-2 font-display text-lg font-bold">
        <span className="font-mono text-[11px] font-normal text-ink-3">{index}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children, verbatim = false }: { label: string; children: React.ReactNode; verbatim?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-3">{label}</dt>
      <dd className={`mt-0.5 ${verbatim ? "" : "capitalize-first"}`}>{children}</dd>
    </div>
  );
}

function LineageStrip({
  lineage,
  current,
  compareId,
  onCompare,
  kitHref,
}: {
  lineage: LineageCard[];
  current: LineageCard;
  compareId: string | null;
  onCompare: (id: string | null) => void;
  kitHref: (id: string) => string | { query: { kit: string } };
}) {
  const currentRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = currentRef.current;
    const strip = el?.parentElement;
    if (el && strip) strip.scrollLeft = el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2;
  }, [current.mold.id]);

  return (
    <ol className="no-scrollbar relative -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {lineage.map((c) => {
        const isCurrent = c.mold.id === current.mold.id;
        const comparing = c.mold.id === compareId;
        return (
          <li
            key={c.mold.id}
            ref={isCurrent ? currentRef : undefined}
            className={`relative w-[120px] shrink-0 rounded-md border p-2 ${isCurrent ? "border-accent bg-paper-2" : comparing ? "border-ink" : "border-rule"}`}
          >
            <Link href={kitHref(c.sku.id)} replace scroll={false} className="block" aria-current={isCurrent ? "true" : undefined}>
              <div className="flex items-center justify-between">
                <GradeChip grade={c.mold.grade} />
                <span className="font-mono text-[10px] text-ink-3">{c.year}</span>
              </div>
              <p className="mt-1.5 truncate font-display text-sm font-bold" title={c.sku.name}>
                {c.mold.versionLabel ?? c.mold.line ?? c.sku.name}
              </p>
            </Link>
            {!isCurrent && (
              <button
                type="button"
                onClick={() => onCompare(comparing ? null : c.mold.id)}
                aria-pressed={comparing}
                className={`mt-1 flex items-center gap-1 font-mono text-[10px] ${comparing ? "text-ink" : "text-ink-3 hover:text-ink"}`}
              >
                <GitCompareArrows size={11} /> {comparing ? "comparing" : "compare"}
              </button>
            )}
            {isCurrent && <p className="mt-1 font-mono text-[10px] text-accent">viewing</p>}
          </li>
        );
      })}
    </ol>
  );
}

function CompareTable({ a, b, onClose }: { a: LineageCard; b: LineageCard; onClose: () => void }) {
  const tri = (v?: boolean, yes = "yes", no = "no") => (v === undefined ? "—" : v ? yes : no);
  const rows: [string, (c: LineageCard) => string][] = [
    ["Grade", (c) => `${c.mold.grade}${c.mold.line ? ` · ${c.mold.line}` : ""}`],
    ["Released", (c) => c.sku.releaseDate],
    ["List price", (c) => yen(c.latestYen)],
    ["Materials", (c) => (c.mold.specs.materials.length ? c.mold.specs.materials.join(", ") : "—")],
    ["ABS", (c) => tri(c.mold.specs.absJoints)],
    ["Glue", (c) => tri(c.mold.specs.requiresGlue, "required", "snap-fit")],
    ["Item code", (c) => c.sku.bandaiItemCode ?? "—"],
    ["JAN", (c) => c.sku.jan ?? "—"],
  ];
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-rule">
      <div className="flex items-center justify-between bg-paper-2 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">Side by side · sourced values only</span>
        <button type="button" onClick={onClose} className="font-mono text-[10px] text-ink-3 hover:text-ink">
          close
        </button>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, get]) => (
            <tr key={label} className="border-t border-rule">
              <td className="w-1/4 px-3 py-1.5 font-mono text-[11px] text-ink-3">{label}</td>
              <td className="px-3 py-1.5">{get(a)}</td>
              <td className="px-3 py-1.5">{get(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
