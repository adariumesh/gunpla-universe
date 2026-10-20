import { Barcode, Droplet, Paintbrush, Star, TriangleAlert, type LucideIcon } from "lucide-react";
import type { GlyphId } from "@/lib/repo";

type Tone = "warn" | "info" | "ok" | "muted";

/** One icon registry for tiles and drawer. Every glyph reflects a sourced fact. */
export const GLYPHS: Record<GlyphId, { icon: LucideIcon; label: string; tone: Tone }> = {
  abs: { icon: TriangleAlert, label: "Lists ABS plastic (Gunpla Wiki): can crack with solvent panel liners", tone: "warn" },
  glue: { icon: Droplet, label: "Glue required (Gunpla Wiki)", tone: "muted" },
  paint: { icon: Paintbrush, label: "Source says painting needed (Gunpla Wiki)", tone: "muted" },
  limited: { icon: Star, label: "Limited release: P-Bandai / event / Gundam Base", tone: "info" },
  jan: { icon: Barcode, label: "Source-published JAN barcode", tone: "ok" },
};

const toneClass: Record<Tone, string> = {
  warn: "text-warn",
  info: "text-accent",
  ok: "text-ok",
  muted: "text-ink-3",
};

export function Glyph({ id, size = 13, withLabel = false }: { id: GlyphId; size?: number; withLabel?: boolean }) {
  const g = GLYPHS[id];
  const Icon = g.icon;
  if (withLabel)
    return (
      <span className="inline-flex items-start gap-2 text-sm text-ink-2">
        <Icon size={size} className={`mt-0.5 shrink-0 ${toneClass[g.tone]}`} aria-hidden />
        {g.label}
      </span>
    );
  return (
    <span title={g.label} className={toneClass[g.tone]}>
      <Icon size={size} aria-label={g.label} />
    </span>
  );
}

export function GradeChip({ grade, className = "" }: { grade: string; className?: string }) {
  const token = ["VINTAGE", "HG", "RG", "MG", "PG", "EG"].includes(grade) ? grade.toLowerCase() : "other";
  const label = grade === "VINTAGE" ? "VTG" : grade;
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-px font-mono text-[0.6875rem] font-medium tracking-wider text-white ${className}`}
      style={{ background: `var(--grade-${token})` }}
    >
      {label}
    </span>
  );
}

export function SourcesBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Every value comes from a cited open source (Gundam Wiki, Gunpla Wiki, Wikipedia, gunpla.fyi). Missing values are shown as missing, never estimated."
      className={`inline-flex -rotate-2 items-center whitespace-nowrap rounded-sm border-2 border-warn px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium uppercase tracking-widest text-warn ${className}`}
    >
      Sourced data · see credits
    </span>
  );
}
