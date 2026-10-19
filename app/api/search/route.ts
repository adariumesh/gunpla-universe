import { NextResponse } from "next/server";
import { getSearchIndex } from "@/lib/repo";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(getSearchIndex());
}
