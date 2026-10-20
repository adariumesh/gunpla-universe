import Link from "next/link";
import type { StrandVM } from "./StrandMap";

/** Below md the diagonal map becomes a vertical metro: one line per timeline. */
export function MetroList({ strands }: { strands: StrandVM[] }) {
  const ordered = [...strands].sort((a, b) => Number(b.stations.some((s) => s.available)) - Number(a.stations.some((s) => s.available)));
  return (
    <div className="px-4 pb-16 pt-20">
      <header className="mb-8 border-2 border-ink bg-panel p-4">
        <p className="font-display text-5xl font-bold leading-none tracking-wide">GUNPLA</p>
        <p className="font-display text-4xl font-semibold leading-tight tracking-[0.2em] text-accent">UNIVERSE</p>
        <p className="mt-3 border-t border-rule pt-2 font-mono text-xs text-ink-3">SHEET 1 OF 3 · MAP</p>
        <Link href="/era/uc-0079-oyw/" className="mt-2 block rounded-sm bg-accent px-2 py-1.5 text-center font-mono text-xs font-semibold text-paper">
          GO TO SHEET 2 → UC 0079 KIT GRID
        </Link>
        <p className="mt-2 text-xs text-ink-2">Or tap any station below for its kit grid, then a kit for its details (sheet 3).</p>
      </header>

      <ol className="space-y-8">
        {ordered.map((s) => {
          const color = `var(--strand-${s.colorToken})`;
          return (
            <li key={s.timelineId}>
              <h2
                className="mb-3 inline-block px-3 py-1 font-display text-lg font-bold text-paper [clip-path:polygon(8px_0,calc(100%-8px)_0,100%_50%,calc(100%-8px)_100%,8px_100%,0_50%)]"
                style={{ background: color }}
              >
                {s.short} {s.name}
              </h2>
              <ol className="ml-3 border-l-[5px] pl-5" style={{ borderColor: color, borderStyle: s.meta ? "dashed" : "solid" }}>
                {[...s.stations].sort((a, b) => a.y - b.y).map((st) => {
                  const works = [...st.works, ...st.leftWorks].map((w) => w.title).join(" · ");
                  const total = st.density.reduce((a, b) => a + b, 0);
                  const body = (
                    <>
                      <span
                        aria-hidden
                        className="absolute -left-[33px] top-1 size-4 rounded-full border-[3px]"
                        style={{ borderColor: color, background: st.available ? color : "var(--paper)" }}
                      />
                      <span className="block font-display text-lg font-bold leading-tight" style={{ color }}>
                        {st.code} {st.label}
                      </span>
                      <span className="block text-sm text-ink-2">{works}</span>
                      <span className="mt-1 block font-mono text-xs text-ink-3">
                        {st.available ? `${total} kits · open matrix →` : "coming soon"}
                      </span>
                    </>
                  );
                  return (
                    <li key={st.eraId} className="relative py-2">
                      {st.available ? (
                        <Link href={`/era/${st.eraId}`} className="block rounded-md active:bg-paper-2">
                          {body}
                        </Link>
                      ) : (
                        <div className="opacity-70">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
