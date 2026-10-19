import { notFound } from "next/navigation";
import Link from "next/link";
import { EraView } from "@/components/matrix/EraView";
import { db } from "@/lib/data";
import { getEra, getEraMatrix } from "@/lib/repo";
import type { Metadata } from "next";

type Props = { params: Promise<{ eraId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return db.eras.map((e) => ({ eraId: e.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const era = getEra((await params).eraId);
  return { title: era ? `${era.code} ${era.label} · Gunpla Universe` : "Gunpla Universe" };
}

export default async function EraPage({ params }: Props) {
  const { eraId } = await params;
  const era = getEra(eraId);
  if (!era) notFound();

  if (!era.available)
    return (
      <main className="drafting-grid grid min-h-dvh place-items-center p-8 text-center">
        <div className="max-w-md border-2 border-dashed border-rule bg-panel p-8">
          <p className="font-mono text-xs uppercase tracking-widest text-hud">Haro: no data! no data!</p>
          <h1 className="mt-2 font-display text-3xl font-bold">
            {era.code} · {era.label}
          </h1>
          <p className="mt-3 text-ink-2">This station&rsquo;s kit matrix isn&rsquo;t in the MVP dataset yet. UC 0079–0093 is live.</p>
          <Link href="/era/uc-0079-oyw" className="mt-5 inline-block rounded-md border border-rule px-4 py-2 text-sm hover:bg-paper-2">
            Open UC 0079 →
          </Link>
        </div>
      </main>
    );

  return <EraView matrix={getEraMatrix(eraId)!} />;
}
