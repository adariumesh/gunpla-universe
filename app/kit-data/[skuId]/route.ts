import { NextResponse } from "next/server";
import { getKit } from "@/lib/repo";

// Per-kit JSON that the in-page drawer loads. Rendered on first request and cached
// until the next deploy (the catalog only changes by commit), so the build doesn't
// pre-render all 3,380 kits.
export const dynamic = "force-static";

export function generateStaticParams() {
  return [];
}

export async function GET(_req: Request, { params }: { params: Promise<{ skuId: string }> }) {
  const detail = getKit((await params).skuId);
  if (!detail) return NextResponse.json({ error: "unknown kit" }, { status: 404 });
  return NextResponse.json(detail);
}
