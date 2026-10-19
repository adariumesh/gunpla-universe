import { NextResponse } from "next/server";
import { catalog } from "@/lib/ingested";

export const dynamic = "force-static";

/** The derived catalog, offered under CC BY-SA as the share-alike terms require. */
export function GET() {
  return NextResponse.json(catalog, {
    headers: { "Content-Disposition": 'inline; filename="gunpla-universe-catalog.json"', "X-License": "CC BY-SA 4.0 (derived from CC BY-SA sources)" },
  });
}
