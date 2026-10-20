"use client";

import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";

export type RailTimeline = {
  id: string;
  short: string;
  name: string;
  colorToken: string;
  stations: { id: string; code: string; label: string; available: boolean }[];
};

/**
 * The L1 strand, straightened. Stays mounted across era changes (it lives in
 * app/era/layout.tsx) so the active marker slides between stations and the
 * matrix re-flows in place instead of bouncing back to the map.
 */
export function EraRail({ rails }: { rails: RailTimeline[] }) {
  const { eraId } = useParams<{ eraId: string }>();
  const rail = rails.find((r) => r.stations.some((s) => s.id === eraId)) ?? rails[0];
  const color = `var(--strand-${rail.colorToken})`;
  const shortCode = (code: string) => code.replace(/^[A-Z]+\s*/, "");

  return (
    <>
      {/* Desktop: vertical rail */}
      <motion.nav
        aria-label={`${rail.name} eras`}
        className="fixed inset-y-0 left-0 z-30 hidden w-[4.75rem] flex-col items-center border-r border-rule bg-panel md:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <Link
          href="/"
          className="mt-3 grid size-10 place-items-center rounded-md border border-rule text-ink-2 hover:text-ink"
          aria-label="Back to timeline map"
          title="Back to timeline map"
        >
          <ArrowLeft size={18} />
        </Link>
        <span className="mt-3 font-display text-sm font-bold" style={{ color }}>
          {rail.short}
        </span>

        <ol className="relative mt-3 flex w-full flex-1 flex-col items-center justify-between pb-6 pt-2">
          <span aria-hidden className="absolute inset-y-0 left-1/2 w-[5px] -translate-x-1/2 rounded-full" style={{ background: color }} />
          {rail.stations.map((s) => {
            const active = s.id === eraId;
            const dot = (
              <span className="relative grid size-7 place-items-center">
                {active && (
                  <motion.span
                    layoutId="rail-active"
                    className="absolute inset-[-6px] rounded-full border-2"
                    style={{ borderColor: color, background: "var(--panel)" }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span
                  className="relative size-3.5 rounded-full border-[3px]"
                  style={{ borderColor: color, background: s.available ? color : "var(--panel)" }}
                />
              </span>
            );
            const label = (
              <span
                className={`relative mt-0.5 rounded px-1 font-mono text-[0.6875rem] leading-none ${active ? "font-medium text-ink" : "text-ink-3"}`}
                style={{ background: "var(--panel)" }}
              >
                {shortCode(s.code)}
              </span>
            );
            return (
              <li key={s.id} className="relative z-10 flex flex-col items-center">
                {s.available ? (
                  <Link
                    href={`/era/${s.id}`}
                    aria-current={active ? "page" : undefined}
                    title={`${s.code} · ${s.label}`}
                    className="flex flex-col items-center hover:[&>span:last-child]:text-ink"
                  >
                    {dot}
                    {label}
                  </Link>
                ) : (
                  <span title={`${s.code} · ${s.label} (coming soon)`} className="flex flex-col items-center opacity-50">
                    {dot}
                    {label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </motion.nav>

      {/* Mobile: the same rail, laid horizontally under the header */}
      <nav aria-label={`${rail.name} eras`} className="sticky top-0 z-30 border-b border-rule bg-panel md:hidden">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto px-3 py-2">
          <Link href="/" aria-label="Back to timeline map" className="mr-1 grid size-8 shrink-0 place-items-center rounded-md border border-rule text-ink-2">
            <ArrowLeft size={16} />
          </Link>
          {rail.stations.filter((s) => s.available).map((s) => {
            const active = s.id === eraId;
            return (
              <Link
                key={s.id}
                href={`/era/${s.id}`}
                aria-current={active ? "page" : undefined}
                className="relative shrink-0 rounded-full px-3 py-1 font-mono text-xs"
                style={{ color: active ? "var(--paper)" : "var(--ink-2)" }}
              >
                {active && (
                  <motion.span layoutId="rail-active-m" className="absolute inset-0 rounded-full" style={{ background: color }} />
                )}
                <span className="relative">{s.code}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
