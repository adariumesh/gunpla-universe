import { NextResponse } from "next/server";
import { db } from "@/lib/data";
import { getKit } from "@/lib/repo";

// Pre-rendered per-kit JSON that the in-page drawer loads (works on static hosting).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return db.skus.map((k) => ({ skuId: k.id }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ skuId: string }> }) {
  const detail = getKit((await params).skuId);
  if (!detail) return NextResponse.json({ error: "unknown kit" }, { status: 404 });
  return NextResponse.json(detail);
}
