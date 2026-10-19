"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { GradeRow, TileCard } from "@/lib/repo";
import type { VisibleBand } from "./model";

const PX_PER_YEAR = 30;
const CHIP_H = 22;
const LABEL_W = 190;

/**
 * Suits as swimlanes, release year on X. Makes the asymmetry the point: you
 * can see where Bandai's attention went (the MG 2.0 wave, the Revive HGs, RG).
 * Chips share layoutIds with the grid tiles, so switching lenses morphs.
 */
export function TimelineLens({
  bands,
  rows,
  yearRange,
}: {
  bands: VisibleBand[];
  rows: GradeRow[];
  yearRange: [number, number];
}) {
  const y0 = Math.min(1980, yearRange[0]);
  const y1 = Math.max(2025, yearRange[1]);
  const width = (y1 - y0 + 1) * PX_PER_YEAR;
  const ticks: number[] = [];
  for (let y = Math.ceil(y0 / 5) * 5; y <= y1; y += 5) ticks.push(y);
  const xOf = (year: number) => (year - y0) * PX_PER_YEAR;

  return (
    <div className="w-max min-w-full pb-10 pr-6" role="table" aria-label="Kit releases by year">
      {/* axis */}
      <div className="sticky top-0 z-20 flex bg-paper" role="row">
        <div className="sticky left-0 z-30 shrink-0 bg-paper" style={{ width: LABEL_W }} />
        <div className="relative h-8 border-b border-rule" style={{ width }}>
          {ticks.map((t) => (
            <span key={t} className="absolute bottom-1 -translate-x-1/2 font-mono text-[11px] text-ink-3" style={{ left: xOf(t) + PX_PER_YEAR / 2 }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {bands.map((b) => (
        <div key={b.faction}>
          <div className="sticky left-0 z-10 w-max bg-paper px-0 pb-1 pt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-3">{b.faction}</div>
          {b.columns.map((c) => {
            const cards = rows.flatMap((r) => c.cellsFiltered[r]).sort((a, z) => a.year - z.year);
            // Greedy lane packing so chips never overlap, even across adjacent years.
            const laneOf = new Map<string, number>();
            const laneEnds: number[] = [];
            for (const k of cards) {
              const left = xOf(k.year) + 2;
              let lane = laneEnds.findIndex((end) => end + 3 <= left);
              if (lane === -1) lane = laneEnds.push(0) - 1;
              laneEnds[lane] = left + chipWidth(k);
              laneOf.set(k.sku.id, lane);
            }
            const depth = Math.max(1, laneEnds.length);
            return (
              <div key={c.suit.id} role="row" className={`flex border-t border-rule ${c.role === "cameo" ? "opacity-60" : ""}`}>
                <div role="rowheader" className="sticky left-0 z-10 shrink-0 bg-paper py-2 pr-3" style={{ width: LABEL_W }}>
                  <p className="font-mono text-[10px] text-ink-3">{c.suit.modelNumber}</p>
                  <p className="truncate font-display text-base font-bold leading-tight">
                    {c.parentId && <span className="text-ink-3">↳ </span>}
                    {c.suit.name}
                  </p>
                </div>
                <div role="cell" className="relative" style={{ width, height: depth * (CHIP_H + 4) + 16 }}>
                  {ticks.map((t) => (
                    <span key={t} aria-hidden className="absolute inset-y-0 w-px bg-rule/60" style={{ left: xOf(t) + PX_PER_YEAR / 2 }} />
                  ))}
                  {cards.map((k) => (
                    <Chip key={k.sku.id} card={k} left={xOf(k.year) + 2} top={8 + laneOf.get(k.sku.id)! * (CHIP_H + 4)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const chipLabel = (card: TileCard) => (card.mold.grade === "VINTAGE" ? "VTG" : card.mold.grade);
const chipVersion = (card: TileCard) => card.mold.versionLabel?.replace("Ver.", "");
const chipWidth = (card: TileCard) =>
  Math.max(PX_PER_YEAR - 4, 8 + chipLabel(card).length * 6.6 + (chipVersion(card) ? 4 + chipVersion(card)!.length * 6.6 : 0));

function Chip({ card, left, top }: { card: TileCard; left: number; top: number }) {
  const token = card.row === "OTHER" ? "other" : card.row.toLowerCase();
  return (
    <motion.div layoutId={`kit-${card.sku.id}`} className="absolute" style={{ left, top }}>
      <Link
        href={`/kit/${card.sku.id}`}
        scroll={false}
        title={`${card.sku.name} (${card.year})`}
        className="flex items-center rounded-sm px-1 font-mono text-[10px] font-medium leading-none text-white shadow-sm ring-offset-1 ring-offset-paper hover:ring-2 hover:ring-accent"
        style={{ background: `var(--grade-${token})`, height: CHIP_H, width: chipWidth(card) }}
      >
        {chipLabel(card)}
        {chipVersion(card) && <span className="ml-1 opacity-80">{chipVersion(card)}</span>}
      </Link>
    </motion.div>
  );
}
