"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GRADE_ROW_LABEL, type GradeRow } from "@/lib/repo";
import { GhostCell, KitStack } from "./KitTile";
import type { VisibleBand, VisibleColumn } from "./model";

const BAND_H = 30;
const COMPACT_W = 172;
const RICH_W = 212;

const KNOWN_TONE: Record<string, string> = {
  EFSF: "var(--strand-uc)",
  AEUG: "var(--strand-ce)",
  "Londo Bell": "var(--strand-ce)",
  Titans: "var(--strand-pd)",
  Zeon: "var(--strand-fc)",
  Axis: "var(--strand-aw)",
  "Neo Zeon": "var(--strand-fc)",
  ZAFT: "var(--strand-fc)",
  "Earth Alliance": "var(--strand-uc)",
  "Celestial Being": "var(--strand-ad00)",
  Tekkadan: "var(--strand-as)",
};
const PALETTE = ["uc", "rc", "fc", "ac", "ad00", "ce", "build", "aw", "ag", "pd", "as", "cc"];

/** Stable colour per faction; unknown factions hash onto the strand palette. */
function factionTone(f: string) {
  if (KNOWN_TONE[f]) return KNOWN_TONE[f];
  let h = 0;
  for (const ch of f) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `var(--strand-${PALETTE[h % PALETTE.length]})`;
}
const FACTION_TONE = new Proxy({} as Record<string, string>, { get: (_t, k: string) => factionTone(k) });

/**
 * Grade swimlanes (rows) × suits grouped by faction (columns). Column width
 * follows kit count so a one-kit suit reads as a deliberate "specimen card"
 * rather than a broken column.
 */
export function GradeGrid({
  bands,
  rows,
  focus,
  spreadAll,
  expandedParents,
  onToggleParent,
}: {
  bands: VisibleBand[];
  rows: GradeRow[];
  focus?: string;
  spreadAll: boolean;
  expandedParents: Set<string>;
  onToggleParent: (id: string) => void;
}) {
  const columns = bands.flatMap((b) => b.columns);
  const [spread, setSpread] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`col-${focus}`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [focus]);

  const toggleSpread = (key: string) =>
    setSpread((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  if (!columns.length) return <p className="p-8 text-ink-3">No suits in this era yet.</p>;

  // Entrance animation only for small eras: a 150-column grid must never wait on animation frames to become visible.
  const animate = columns.length <= 30;
  const template = `var(--label-w) ${columns.map((c) => `${c.compact ? COMPACT_W : RICH_W}px`).join(" ")}`;

  return (
    <div
      role="table"
      aria-label="Mobile suits by Gunpla grade"
      className="matrix-grid grid w-max min-w-full gap-x-3 pb-10 pr-6"
      style={{ gridTemplateColumns: template }}
    >
      {/* Row 1: faction bands */}
      <div className="sticky left-0 top-0 z-30 bg-paper" style={{ height: BAND_H }} />
      {bands.map((b) => (
        <div
          key={b.faction}
          className="sticky top-0 z-20 flex items-end bg-paper"
          style={{ gridColumn: `span ${b.columns.length}`, height: BAND_H }}
        >
          <div className="w-full border-b-[3px] pb-1 font-mono text-[11px] font-medium uppercase tracking-[0.2em]" style={{ borderColor: FACTION_TONE[b.faction], color: FACTION_TONE[b.faction] }}>
            {b.faction}
          </div>
        </div>
      ))}

      {/* Row 2: suit headers */}
      <div role="row" className="contents">
        <div className="sticky left-0 z-30 bg-paper" style={{ top: BAND_H }} />
        {columns.map((c, i) => (
          <SuitHeader
            key={c.suit.id}
            col={c}
            index={i}
            focused={c.suit.id === focus}
            expanded={expandedParents.has(c.suit.id)}
            onToggleVariants={() => onToggleParent(c.suit.id)}
            animate={animate}
          />
        ))}
      </div>

      {/* Grade swimlanes */}
      {rows.map((r) => (
        <div role="row" key={r} className="contents">
          <div role="rowheader" className="sticky left-0 z-10 flex flex-col justify-start border-t border-rule bg-paper py-3 pr-2">
            <span className="font-display text-sm font-bold leading-tight md:text-base">{GRADE_ROW_LABEL[r]}</span>
            <span className="hidden font-mono text-[10px] text-ink-3 md:block">{r === "VINTAGE" ? "1980s–90s" : r === "OTHER" ? "misc. lines" : r}</span>
          </div>
          {columns.map((c, i) => {
            const cards = c.cellsFiltered[r];
            const key = `${c.suit.id}:${r}`;
            return (
              <motion.div
                role="cell"
                key={key}
                initial={animate ? { opacity: 0, y: 10 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + Math.min(i, 12) * 0.025, duration: 0.25 }}
                className={`border-t border-rule py-3 ${c.role === "cameo" ? "opacity-60 saturate-50 hover:opacity-100 hover:saturate-100" : ""}`}
              >
                {cards.length ? (
                  <KitStack cards={cards} expanded={spreadAll || spread.has(key)} onToggle={() => toggleSpread(key)} />
                ) : (
                  <GhostCell row={r} filtered={c.cells[r].length > 0} />
                )}
              </motion.div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SuitHeader({
  col,
  index,
  focused,
  expanded,
  onToggleVariants,
  animate,
}: {
  col: VisibleColumn;
  index: number;
  focused: boolean;
  expanded: boolean;
  onToggleVariants: () => void;
  animate: boolean;
}) {
  const s = col.suit;
  const hasVariants = col.variantIds.length > 0;
  const tone = FACTION_TONE[s.faction];
  const visible = Object.values(col.cellsFiltered).reduce((n, cards) => n + cards.length, 0);
  return (
    <motion.div
      role="columnheader"
      id={`col-${s.id}`}
      initial={animate ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.025, duration: 0.25 }}
      className={`sticky z-20 flex flex-col justify-end bg-paper pb-2 pt-2 ${col.parentId ? "border-l-2 border-dashed border-rule pl-2" : ""} ${
        col.role === "cameo" ? "opacity-60" : ""
      }`}
      style={{ top: BAND_H }}
    >
      <div className={`rounded-md ${focused ? "ring-2 ring-accent ring-offset-2 ring-offset-paper" : ""}`}>
        <p className="font-mono text-[11px]" style={{ color: tone }}>
          {s.name.toUpperCase().startsWith(s.modelNumber.toUpperCase()) ? "\u00A0" : s.modelNumber}
        </p>
        <p className="truncate font-display text-lg font-bold leading-tight" title={s.name}>
          {s.name}
        </p>
        <p className="truncate text-[11px] text-ink-3">
          {col.parentId
            ? `↳ ${s.variantKind?.replace(/-/g, " ")}`
            : s.pilot
              ? s.pilot
              : s.continuity !== "main"
                ? s.continuity
                : " "}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-ink-3">
          <span title={`${col.kitCount} releases in total, including variants and limited editions`}>
            {visible} kit{visible === 1 ? "" : "s"}
            {col.kitCount > visible && <span className="text-ink-3/70"> · {col.kitCount - visible} hidden</span>}
          </span>
          {col.role === "cameo" && (
            <Link href={`/era/${s.debutEraId}?focus=${s.id}`} className="rounded-sm border border-rule px-1 hover:text-ink">
              cameo · debut →
            </Link>
          )}
          {col.role === "main" && <span className="rounded-sm border border-rule px-1">carry-over</span>}
          {s.placement?.by === "none" && (
            <span
              className="rounded-sm border border-dashed border-warn px-1 text-warn"
              title="No source states this suit's series or in-universe debut, so it is shown on its timeline's first station."
            >
              undated
            </span>
          )}
          {s.continuity !== "main" && <span className="rounded-sm border border-rule px-1">{s.continuity}</span>}
          {hasVariants && (col.hiddenVariants > 0 || expanded) && (
            <button
              type="button"
              onClick={onToggleVariants}
              aria-expanded={expanded}
              className="rounded-sm border border-accent px-1 text-accent hover:bg-accent hover:text-paper"
            >
              {expanded ? "− variants" : `+${col.hiddenVariants} variant${col.hiddenVariants === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
