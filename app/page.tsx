import { StrandMap, type StrandVM } from "@/components/timeline/StrandMap";
import { MetroList } from "@/components/timeline/MetroList";
import { TopControls } from "@/components/TopControls";
import { db } from "@/lib/data";
import { strands } from "@/lib/layout/strands";
import { getEraDensity, getTimelines } from "@/lib/repo";

function buildStrands(): StrandVM[] {
  const eraById = new Map(db.eras.map((e) => [e.id, e]));
  const workById = new Map(db.works.map((w) => [w.id, w]));
  const timelineById = new Map(getTimelines().map((t) => [t.id, t]));

  return strands.map((s) => {
    const t = timelineById.get(s.timelineId)!;
    return {
      ...s,
      name: t.name,
      short: t.short,
      colorToken: t.colorToken,
      meta: t.meta,
      stations: s.stations.map((st) => {
        const era = eraById.get(st.eraId)!;
        const left = new Set(st.leftWorks ?? []);
        const title = (id: string) => ({ id, title: workById.get(id)!.title });
        return {
          ...st,
          code: era.code,
          label: era.label,
          available: era.available,
          works: era.workIds.filter((w) => !left.has(w)).map(title),
          leftWorks: era.workIds.filter((w) => left.has(w)).map(title),
          density: era.available ? getEraDensity(era.id) : [],
        };
      }),
    };
  });
}

export default function Home() {
  const vm = buildStrands();
  const cc = db.eras.find((e) => e.timelineId === "CC")!;

  return (
    <main className="drafting-grid relative min-h-dvh">
      <TopControls className="fixed right-4 top-4 z-20" />
      <h1 className="sr-only">Gunpla Universe: Gundam timeline transit map</h1>
      <div className="hidden md:block">
        <StrandMap strands={vm} cc={{ code: cc.code, label: cc.label }} />
      </div>
      <div className="md:hidden">
        <MetroList strands={vm} />
      </div>
    </main>
  );
}
