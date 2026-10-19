"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Glyph, GradeChip } from "@/components/Glyph";
import { GRADE_ROW_LABEL, type GradeRow, type TileCard } from "@/lib/repo";

const yen = (n: number | null) => (n === null ? "¥ —" : `¥${n.toLocaleString("en-US")}`);

/** Schematic plate standing in for box art (licensing TBD — see spec). */
export function ArtPlate({ card, big = false }: { card: TileCard; big?: boolean }) {
  const token = card.row === "OTHER" ? "other" : card.row.toLowerCase();
  const headline = card.mold.versionLabel ?? card.mold.line ?? (card.row === "OTHER" ? card.mold.grade : card.mold.scale);
  return (
    <div
      className={`hatch relative flex flex-col justify-end overflow-hidden rounded-sm border-l-4 bg-paper-2 px-2 ${big ? "h-28 py-3" : "h-12 py-1"}`}
      style={{ borderColor: `var(--grade-${token})` }}
      aria-hidden
    >
      <span className={`font-display font-bold leading-none text-ink ${big ? "text-4xl" : "text-lg"}`}>{headline}</span>
      <span className={`font-mono text-ink-3 ${big ? "mt-1 text-xs" : "text-[9px]"}`}>
        {card.mold.scale} · {card.mold.subjects[0].suitId.toUpperCase()}
      </span>
      {card.sku.edition !== "standard" && (
        <span className="absolute right-1.5 top-1.5 rounded-sm bg-accent px-1 font-mono text-[8px] uppercase text-paper">
          {card.sku.edition.replace("-", " ")}
        </span>
      )}
    </div>
  );
}

export function KitTile({ card, layout = true }: { card: TileCard; layout?: boolean }) {
  return (
    <motion.div layoutId={layout ? `kit-${card.sku.id}` : undefined} className="relative">
      <Link
        href={`/kit/${card.sku.id}`}
        scroll={false}
        className="group relative block overflow-hidden rounded-md border border-rule bg-panel p-2 shadow-[0_1px_0_var(--rule)] transition-colors hover:border-accent focus-visible:border-accent"
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <GradeChip grade={card.mold.grade} />
          <span className="font-mono text-[10px] text-ink-3">{card.mold.scale}</span>
          <span className="ml-auto font-mono text-[11px] font-medium text-ink-2">{card.year}</span>
        </div>
        <ArtPlate card={card} />
        <p className="mt-1.5 line-clamp-2 min-h-[2.4em] text-[12px] leading-tight text-ink">{card.sku.name}</p>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="font-mono text-[10px] text-ink-3">{card.sku.bandaiItemCode ? `#${card.sku.bandaiItemCode}` : "\u00A0"}</span>
          <span className="flex gap-1">
            {card.glyphs.slice(0, 4).map((g) => (
              <Glyph key={g} id={g} size={12} />
            ))}
          </span>
        </div>
        {/* hover/focus peek */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-ink px-2 py-1 font-mono text-[10px] text-paper transition-transform group-hover:translate-y-0 group-focus-visible:translate-y-0">
          {yen(card.latestYen)}{card.sku.jan ? ` · JAN ${card.sku.jan}` : ""}
        </div>
      </Link>
    </motion.div>
  );
}

/** Rendered ~1,000 times on big eras, so it is one short class + a data label (see globals.css). */
export function GhostCell({ row, filtered }: { row: GradeRow; filtered: boolean }) {
  const label = filtered ? "Hidden by filters" : `Never kitted in ${GRADE_ROW_LABEL[row]}`;
  return <div className="ghost hatch" data-label={label} role="note" aria-label={label} />;
}

/**
 * A cell is a stack, not a slot: the newest release sits on top, older ones
 * peek out behind it, and the count badge spreads the deck inline.
 */
export function KitStack({
  cards,
  expanded,
  onToggle,
}: {
  cards: TileCard[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const [top, ...rest] = cards;
  const n = cards.length;
  return (
    <div className="relative">
      {n > 1 && !expanded && (
        <>
          {n > 2 && <span aria-hidden className="absolute inset-0 translate-x-[8px] translate-y-[8px] rounded-md border border-rule bg-paper-2" />}
          <span aria-hidden className="absolute inset-0 translate-x-[4px] translate-y-[4px] rounded-md border border-rule bg-panel" />
        </>
      )}
      <KitTile card={top} />
      <AnimatePresence initial={false}>
        {expanded &&
          rest.map((c, i) => (
            <motion.div
              key={c.sku.id}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
              exit={{ opacity: 0, y: -16 }}
              className="mt-2"
            >
              <KitTile card={c} />
            </motion.div>
          ))}
      </AnimatePresence>
      {n > 1 && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse stack" : `Spread ${n} kits`}
          className="absolute -right-2 -top-2 z-10 flex items-center gap-0.5 rounded-full border border-rule bg-ink px-1.5 py-0.5 font-mono text-[10px] font-medium text-paper hover:bg-accent"
        >
          ×{n}
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      )}
    </div>
  );
}
