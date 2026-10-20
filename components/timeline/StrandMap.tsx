"use client";

import { animate, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CC_RING, VIEWBOX, workLabelPos, type StationLayout, type StrandLayout } from "@/lib/layout/strands";

export type StationVM = Omit<StationLayout, "leftWorks"> & {
  code: string;
  label: string;
  available: boolean;
  works: { id: string; title: string }[];
  leftWorks: { id: string; title: string }[];
  density: number[];
};

export type StrandVM = Omit<StrandLayout, "stations"> & {
  name: string;
  short: string;
  colorToken: string;
  meta: boolean;
  stations: StationVM[];
};

const RAIL_SCREEN_X = 38; // centre of the L2 era rail, in CSS px

type Selection = { timelineId: string; eraId: string; cx: number; cy: number; tx: number; ty: number };

/**
 * L1 transit map. Clicking an available station "straightens" its strand:
 * the strand rotates from 45° to vertical around the station and slides to
 * where the L2 era rail sits, while everything else fades out. Then we route.
 */
export function StrandMap({ strands, cc }: { strands: StrandVM[]; cc: { code: string; label: string } }) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const reduceMotion = useReducedMotion();
  const [sel, setSel] = useState<Selection | null>(null);
  const [t, setT] = useState(0);

  const go = (strand: StrandVM, st: StationVM) => {
    const href = `/era/${st.eraId}`;
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (reduceMotion || !svg || !ctm || sel) {
      router.push(href);
      return;
    }
    const p = svg.createSVGPoint();
    p.x = RAIL_SCREEN_X;
    p.y = window.innerHeight * 0.45;
    const target = p.matrixTransform(ctm.inverse());
    setSel({ timelineId: strand.timelineId, eraId: st.eraId, cx: st.x, cy: st.y, tx: target.x, ty: target.y });
    router.prefetch(href);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      router.push(href);
    };
    animate(0, 1, { duration: 0.55, ease: [0.65, 0, 0.35, 1], onUpdate: setT, onComplete: finish });
    // rAF is paused in background tabs; never strand the user on the map.
    setTimeout(finish, 900);
  };

  const fade = (timelineId: string) => (sel && sel.timelineId !== timelineId ? 1 - 0.92 * t : 1);
  const labelFade = sel ? Math.max(0, 1 - t * 1.8) : 1;
  const transformFor = (timelineId: string) =>
    sel && sel.timelineId === timelineId
      ? `translate(${(sel.tx - sel.cx) * t} ${(sel.ty - sel.cy) * t}) rotate(${45 * t} ${sel.cx} ${sel.cy})`
      : undefined;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      className="mx-auto block h-auto w-full max-w-[1500px] select-none"
      role="group"
      aria-label="Gundam timelines. Select a station to open its kit matrix."
    >
      <defs>
        <linearGradient id="cc-ring" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--strand-ce)" />
          <stop offset="0.35" stopColor="var(--strand-uc)" />
          <stop offset="0.65" stopColor="var(--strand-aw)" />
          <stop offset="1" stopColor="var(--strand-cc)" />
        </linearGradient>
      </defs>

      <TitleBlock opacity={labelFade} />

      {/* Correct Century: the terminus every line converges on */}
      <g opacity={sel ? 1 - 0.92 * t : 1}>
        <path
          d={`M ${CC_RING.cx - CC_RING.r} ${CC_RING.cy} A ${CC_RING.r} ${CC_RING.r} 0 0 1 ${CC_RING.cx} ${CC_RING.cy - CC_RING.r}`}
          fill="none"
          stroke="url(#cc-ring)"
          strokeWidth={CC_RING.width}
        />
        <g textAnchor="end" className="font-display" fill="var(--ink)">
          <text x={1406} y={1355} fontSize={24} fontWeight={600}>C.C.</text>
          <text x={1406} y={1385} fontSize={24} fontWeight={600}>Correct Century</text>
          <text x={1406} y={1431} fontSize={22} fontWeight={600} fill="var(--strand-cc)">{cc.code} {cc.label.split(" ")[0]}</text>
          <text x={1406} y={1457} fontSize={22} fontWeight={600} fill="var(--strand-cc)">{cc.label.split(" ").slice(1).join(" ")}</text>
          <text x={1406} y={1489} fontSize={20} fill="var(--ink-2)" className="font-sans">Turn A Gundam</text>
        </g>
      </g>

      {strands.map((s) => (
        <g key={s.timelineId} opacity={fade(s.timelineId)} transform={transformFor(s.timelineId)}>
          <Strand strand={s} labelOpacity={sel?.timelineId === s.timelineId ? labelFade : 1} onSelect={go} activeEra={sel?.eraId} />
        </g>
      ))}
    </svg>
  );
}

function Strand({
  strand: s,
  labelOpacity,
  onSelect,
  activeEra,
}: {
  strand: StrandVM;
  labelOpacity: number;
  onSelect: (s: StrandVM, st: StationVM) => void;
  activeEra?: string;
}) {
  const color = `var(--strand-${s.colorToken})`;
  const headerText = `${s.short} ${s.name}`;
  const headerW = headerText.length * 8.4 + 34;

  return (
    <g>
      {s.segments.map((seg, i) => (
        <line
          key={i}
          x1={seg.from[0]}
          y1={seg.from[1]}
          x2={seg.to[0]}
          y2={seg.to[1]}
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={s.meta ? "16 9" : undefined}
        />
      ))}
      {s.tail && (
        <line
          x1={s.tail.from[0]}
          y1={s.tail.from[1]}
          x2={s.tail.to[0]}
          y2={s.tail.to[1]}
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray="0.1 14"
        />
      )}

      <g opacity={labelOpacity}>
        {s.gaps?.map((g) => (
          <g key={g.label}>
            <line x1={g.x1} y1={g.y} x2={g.x2} y2={g.y} stroke="var(--ink-2)" strokeWidth={3} strokeDasharray="10 6" />
            <text x={g.x1 + 8} y={g.y - 8} fontSize={17} fontWeight={600} fill="var(--ink-2)" className="font-display">
              {g.label}
            </text>
          </g>
        ))}

        {s.header.x > 0 && (
          <g>
            <path
              d={`M ${s.header.x} ${s.header.y} l 11 -12 h ${headerW - 22} l 11 12 l -11 12 h ${-(headerW - 22)} z`}
              fill={color}
            />
            <text x={s.header.x + 17} y={s.header.y + 6} fontSize={17} fontWeight={700} fill="var(--paper)" className="font-display">
              {headerText}
            </text>
          </g>
        )}
      </g>

      {s.stations.map((st) => (
        <Station
          key={st.eraId}
          st={st}
          color={color}
          labelOpacity={labelOpacity}
          active={activeEra === st.eraId}
          onSelect={() => onSelect(s, st)}
        />
      ))}
    </g>
  );
}

function Station({
  st,
  color,
  labelOpacity,
  active,
  onSelect,
}: {
  st: StationVM;
  color: string;
  labelOpacity: number;
  active: boolean;
  onSelect: () => void;
}) {
  const left = st.side === "left";
  const title = `${st.code} ${st.label}`;

  const labels = (
    <g opacity={labelOpacity}>
      {st.side === "along" ? (
        <g transform={`rotate(45 ${st.x} ${st.y})`} className="font-display" fontWeight={600}>
          <text x={st.x + 20} y={st.y + 6} fontSize={17} fill={color}>{title}</text>
          {st.works.map((w, i) => (
            <text key={w.id} x={st.x - 30} y={st.y + 34 + i * 22} fontSize={15} fill="var(--ink-2)" fontWeight={400} className="font-sans">
              {w.title}
            </text>
          ))}
        </g>
      ) : (
        <>
          <text
            x={left ? st.x - 18 : st.x + 18}
            y={st.y + 6}
            textAnchor={left ? "end" : "start"}
            fontSize={18}
            fontWeight={700}
            fill={color}
            className={`font-display ${st.available ? "station-title" : ""}`}
          >
            {title}
            {/* Kit count inline with the title keeps each station to title + works lines. */}
            {st.available && st.density.length > 0 && (
              <tspan fontSize={11} fontWeight={400} fill="var(--ink-3)" className="font-mono" dx={8}>
                {st.density.reduce((a, b) => a + b, 0)} kits
              </tspan>
            )}
          </text>
          {st.works.map((w, i) => {
            const p = workLabelPos(st, i, false);
            return (
              <text key={w.id} x={p.x} y={p.y} textAnchor={p.anchor} fontSize={15} fill="var(--ink-2)">
                {w.title}
              </text>
            );
          })}
          {st.leftWorks.map((w, i) => {
            const p = workLabelPos(st, i, true);
            return (
              <text key={w.id} x={p.x} y={p.y} textAnchor={p.anchor} fontSize={15} fill="var(--ink-2)">
                {w.title}
              </text>
            );
          })}
        </>
      )}
    </g>
  );

  const dot = (
    <>
      {st.available && (
        <circle cx={st.x} cy={st.y} r={active ? 17 : 15} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 3" className="station-ring" />
      )}
      <circle cx={st.x} cy={st.y} r={10} fill={st.available ? color : "var(--paper)"} stroke={color} strokeWidth={st.available ? 0 : 3} />
      <circle cx={st.x} cy={st.y} r={4} fill="var(--paper)" opacity={st.available ? 1 : 0} />
    </>
  );

  if (!st.available)
    return (
      <g opacity={0.72}>
        <title>{`${title}: kit matrix coming soon`}</title>
        {dot}
        {labels}
      </g>
    );

  return (
    <a
      href={`/era/${st.eraId}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onSelect();
      }}
      aria-label={`${title}: open kit matrix`}
      className="station cursor-pointer outline-none"
    >
      {/* generous invisible hit target */}
      <rect x={left ? st.x - 300 : st.x - 20} y={st.y - 20} width={320} height={40} fill="transparent" />
      {dot}
      {labels}
    </a>
  );
}

/** Drafting-sheet title block, top right. */
function TitleBlock({ opacity }: { opacity: number }) {
  const x = 968;
  const y = 92;
  const w = 350;
  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={w} height={262} fill="var(--panel)" stroke="var(--ink)" strokeWidth={2} />
      <line x1={x} y1={y + 150} x2={x + w} y2={y + 150} stroke="var(--ink)" strokeWidth={1.5} />
      <line x1={x} y1={y + 192} x2={x + w} y2={y + 192} stroke="var(--rule)" />
      <line x1={x + w / 2} y1={y + 150} x2={x + w / 2} y2={y + 262} stroke="var(--rule)" />
      <line x1={x} y1={y + 228} x2={x + w} y2={y + 228} stroke="var(--rule)" />
      <text x={x + 20} y={y + 70} fontSize={64} fontWeight={700} fill="var(--ink)" className="font-display" letterSpacing={2}>
        GUNPLA
      </text>
      <text x={x + 20} y={y + 128} fontSize={52} fontWeight={600} fill="var(--accent)" className="font-display" letterSpacing={6}>
        UNIVERSE
      </text>
      {[
        ["DWG", "TIMELINE TRANSIT", 0, 0],
        ["SHEET", "1 OF 3 · MAP", 1, 0],
        ["SCOPE", "ALL TIMELINES", 0, 1],
        ["SCALE", "1 : 144", 1, 1],
      ].map(([k, v, col, row]) => (
        <g key={k as string}>
          <text x={x + 12 + (col as number) * (w / 2)} y={y + 168 + (row as number) * 40} fontSize={10} fill="var(--ink-3)" className="font-mono" letterSpacing={1.5}>
            {k}
          </text>
          <text x={x + 12 + (col as number) * (w / 2)} y={y + 184 + (row as number) * 40} fontSize={14} fill="var(--ink)" className="font-mono">
            {v}
          </text>
        </g>
      ))}
      {/* Sheet 2 is any era's kit grid: offer a direct way in, not just a hint. */}
      <a href={"/era/uc-0079-oyw"} className="sheet-link">
        <rect x={x + 8} y={y + 234} width={w - 16} height={22} rx={3} fill="var(--accent)" />
        <text x={x + w / 2} y={y + 249} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--paper)" className="font-mono">
          {"GO TO SHEET 2 → UC 0079 KIT GRID"}
        </text>
      </a>
      <text x={x} y={y + 282} fontSize={12.5} fill="var(--ink-2)">
        Or click any station dot for its kit grid (sheet 2),
      </text>
      <text x={x} y={y + 300} fontSize={12.5} fill="var(--ink-2)">
        then click a kit for its details (sheet 3).
      </text>
    </g>
  );
}

