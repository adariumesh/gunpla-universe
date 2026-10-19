import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KitDetailView } from "@/components/drawer/KitDetailView";
import { TopControls } from "@/components/TopControls";
import { getKit } from "@/lib/repo";

type Props = { params: Promise<{ skuId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = getKit((await params).skuId);
  return { title: d ? `${d.card.sku.name} · Gunpla Universe` : "Gunpla Universe" };
}

/** Direct-link / refresh version of the kit drawer. */
export default async function KitPage({ params }: Props) {
  const detail = getKit((await params).skuId);
  if (!detail) notFound();
  const era = detail.eras.find((e) => e.id === detail.primarySuit.debutEraId) ?? detail.eras[0];
  return (
    <main className="drafting-grid min-h-dvh">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur">
        <Link href={`/era/${era.id}?focus=${detail.primarySuit.id}`} className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft size={16} /> {era.code} · {era.label}
        </Link>
        <TopControls />
      </div>
      <div className="mx-auto max-w-2xl border-x border-rule bg-panel">
        <KitDetailView detail={detail} />
      </div>
    </main>
  );
}
