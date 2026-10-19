"use client";

import { ChartGantt, LayoutGrid } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { MockBadge } from "@/components/Glyph";
import { TopControls } from "@/components/TopControls";
import { GRADE_ROWS, GRADE_ROW_LABEL, type EraMatrix, type GradeRow } from "@/lib/repo";
import { GradeGrid } from "./GradeGrid";
import { TimelineLens } from "./TimelineLens";
import { defaultFilters, visibleBands, type Filters, type SortKey } from "./model";

type Lens = "grid" | "timeline";

/** Reads ?focus= in the browser so the era page itself can be pre-rendered as static HTML. */
function FocusReader({ onFocus }: { onFocus: (id: string) => void }) {
  const focus = useSearchParams().get("focus");
  useEffect(() => {
    if (focus) onFocus(focus);
  }, [focus, onFocus]);
  return null;
}

export function EraView({ matrix }: { matrix: EraMatrix }) {
  const [lens, setLens] = useState<Lens>("grid");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sort, setSort] = useState<SortKey>("canon");
  const [focus, setFocus] = useState<string>();
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!focus) return;
    // Deep link to a collapsed variant opens its parent.
    const target = matrix.factions.flatMap((f) => f.columns).find((c) => c.suit.id === focus);
    if (target?.suit.variantOf) setExpandedParents((s) => new Set([...s, target.suit.variantOf!]));
  }, [focus, matrix]);
  const [spreadAll, setSpreadAll] = useState(false);

  const bands = useMemo(() => visibleBands(matrix, filters, sort, expandedParents), [matrix, filters, sort, expandedParents]);
  const rows = GRADE_ROWS.filter((r) => filters.rows.has(r));
  const suitCount = bands.reduce((n, b) => n + b.columns.length, 0);
  const color = `var(--strand-${matrix.timeline.colorToken})`;

  const toggleParent = (id: string) =>
    setExpandedParents((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleRow = (r: GradeRow) =>
    setFilters((f) => {
      const rowsNext = new Set(f.rows);
      if (rowsNext.has(r) && rowsNext.size > 1) rowsNext.delete(r);
      else rowsNext.add(r);
      return { ...f, rows: rowsNext };
    });

  return (
    <main className="flex h-dvh flex-col md:h-dvh">
      <Suspense fallback={null}>
        <FocusReader onFocus={setFocus} />
      </Suspense>
      <header className="shrink-0 border-b border-rule bg-paper px-4 pb-3 pt-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color }}>
              <span className="mr-2 rounded-sm border border-current px-1">Sheet 2 of 3 · kit grid</span>
              {matrix.timeline.short} {matrix.timeline.name} / {matrix.era.code}
            </p>
            <motion.h1
              key={matrix.era.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-display text-3xl font-bold leading-tight md:text-4xl"
            >
              {matrix.era.label}
            </motion.h1>
            <p className="mt-0.5 text-sm text-ink-2">
              {matrix.works.map((w) => `${w.title} (${w.releaseYear})`).join(" · ")}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-3">
              {suitCount} suits · {matrix.kitCount} kits · {matrix.yearRange[0]}–{matrix.yearRange[1]}
              <span className="ml-3 inline-flex align-middle lg:hidden">
                <MockBadge />
              </span>
            </p>
          </div>
          <TopControls />
        </div>

        <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <Segmented
            value={lens}
            onChange={setLens}
            options={[
              { value: "grid", label: "Grade grid", icon: <LayoutGrid size={14} /> },
              { value: "timeline", label: "Release timeline", icon: <ChartGantt size={14} /> },
            ]}
          />
          <span className="mx-1 h-6 w-px shrink-0 bg-rule" />
          {GRADE_ROWS.map((r) => (
            <Chip key={r} on={filters.rows.has(r)} onClick={() => toggleRow(r)} title={`Toggle ${GRADE_ROW_LABEL[r]} row`}>
              {r === "OTHER" ? "Other" : r === "VINTAGE" ? "Vintage" : r}
            </Chip>
          ))}
          <span className="mx-1 h-6 w-px shrink-0 bg-rule" />
          <Chip on={filters.noAbs} onClick={() => setFilters((f) => ({ ...f, noAbs: !f.noAbs }))} title="Only kits whose source-listed plastics exclude ABS">
            Confirmed no ABS
          </Chip>
          <Chip on={filters.withJan} onClick={() => setFilters((f) => ({ ...f, withJan: !f.withJan }))} title="Only kits with a source-published JAN barcode">
            Has JAN
          </Chip>
          <Chip on={filters.variants} onClick={() => setFilters((f) => ({ ...f, variants: !f.variants }))} title="Show recolors, clear/metallic and limited editions">
            Variants &amp; limited
          </Chip>
          <span className="mx-1 h-6 w-px shrink-0 bg-rule" />
          {lens === "grid" && (
            <Chip on={spreadAll} onClick={() => setSpreadAll((s) => !s)} title="Spread every stack">
              Spread stacks
            </Chip>
          )}
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-3">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-7 rounded-md border border-rule bg-panel px-1.5 text-xs text-ink"
            >
              <option value="canon">Hero suits first</option>
              <option value="kits">Most kits</option>
              <option value="model">Model number</option>
            </select>
          </label>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-auto" id="matrix-scroll">
        <LayoutGroup id="lens">
          {lens === "grid" ? (
            <GradeGrid
              key={matrix.era.id}
              bands={bands}
              rows={rows}
              focus={focus}
              spreadAll={spreadAll}
              onToggleParent={toggleParent}
              expandedParents={expandedParents}
            />
          ) : (
            <TimelineLens key={matrix.era.id} bands={bands} rows={rows} yearRange={matrix.yearRange} />
          )}
        </LayoutGroup>
      </div>
    </main>
  );
}

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={`h-7 shrink-0 rounded-full border px-2.5 text-xs transition-colors ${
        on ? "border-ink bg-ink text-paper" : "border-rule bg-panel text-ink-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon: React.ReactNode }[];
}) {
  return (
    <div role="radiogroup" aria-label="Lens" className="flex shrink-0 rounded-md border border-rule bg-panel p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`relative flex h-7 items-center gap-1.5 rounded px-2.5 text-xs ${value === o.value ? "text-paper" : "text-ink-2"}`}
        >
          {value === o.value && <motion.span layoutId="lens-pill" className="absolute inset-0 rounded bg-ink" />}
          <span className="relative">{o.icon}</span>
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
