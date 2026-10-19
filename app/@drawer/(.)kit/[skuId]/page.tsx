import { notFound } from "next/navigation";
import { KitDrawer } from "@/components/drawer/KitDrawer";
import { KitDetailView } from "@/components/drawer/KitDetailView";
import { getKit } from "@/lib/repo";

/** Intercepted /kit/[skuId]: renders as a drawer over the current matrix. */
export default async function KitDrawerPage({ params }: { params: Promise<{ skuId: string }> }) {
  const detail = getKit((await params).skuId);
  if (!detail) notFound();
  return (
    <KitDrawer title={detail.card.sku.name}>
      <KitDetailView detail={detail} />
    </KitDrawer>
  );
}
