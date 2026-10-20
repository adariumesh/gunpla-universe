import { Suspense } from "react";
import { KitDrawerHost } from "@/components/drawer/KitDrawerHost";
import { EraRail, type RailTimeline } from "@/components/timeline/EraRail";
import { db } from "@/lib/data";
import { getTimelines } from "@/lib/repo";

export default function EraLayout({ children }: { children: React.ReactNode }) {
  const rails: RailTimeline[] = getTimelines().map((t) => ({
    id: t.id,
    short: t.short,
    name: t.name,
    colorToken: t.colorToken,
    stations: db.eras
      .filter((e) => e.timelineId === t.id)
      .map((e) => ({ id: e.id, code: e.code, label: e.label, available: e.available })),
  }));

  return (
    <div className="min-h-dvh md:pl-[4.75rem]">
      <EraRail rails={rails} />
      {children}
      <Suspense fallback={null}>
        <KitDrawerHost />
      </Suspense>
    </div>
  );
}
