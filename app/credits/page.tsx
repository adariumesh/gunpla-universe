import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TopControls } from "@/components/TopControls";
import { db } from "@/lib/data";
import { catalog } from "@/lib/ingested";

export const metadata: Metadata = { title: "Credits & data sources · Gunpla Universe" };

type Row = { name: string; url: string; license: string; used: string; pages: number; records: number };

function sourceRows(): Row[] {
  const pages = new Map<string, Set<string>>();
  const records = new Map<string, number>();
  const add = (name: string, url: string) => {
    if (!pages.has(name)) pages.set(name, new Set());
    pages.get(name)!.add(url);
    records.set(name, (records.get(name) ?? 0) + 1);
  };
  for (const k of db.skus) for (const r of [...k.provenance.refs, ...(k.janSources ?? [])]) add(r.name, r.url);
  for (const m of db.molds) for (const r of m.provenance.refs) add(r.name, r.url);
  for (const s of catalog.suits) add(s.source.name, s.source.url);
  const meta: Record<string, Omit<Row, "pages" | "records">> = {
    "gundam-wiki": {
      name: "Gundam Wiki (Fandom)",
      url: "https://gundam.fandom.com",
      license: "CC BY-SA 3.0",
      used: "Kit list tables for every Gunpla line (line no., release month, list price, edition), {{merch}} entries, mobile-suit infoboxes (timeline, debut, operator, pilot), notes",
    },
    "gunpla-wiki": {
      name: "Gunpla Wiki (Fandom)",
      url: "https://gunpla.fandom.com",
      license: "CC BY-SA",
      used: "Per-kit pages: JAN barcodes, exact release dates, materials (ABS/KPS), glue and paint requirements",
    },
    "ja-wikipedia": {
      name: "Wikipedia (Japanese)",
      url: "https://ja.wikipedia.org",
      license: "CC BY-SA 4.0",
      used: "Independent cross-check of release months by line number",
    },
    "gunpla-fyi": {
      name: "gunpla.fyi",
      url: "https://gunpla.fyi",
      license: "Factual data (no license stated); used with attribution",
      used: "Bandai item codes, official English names and manual links (index of Bandai's manual site)",
    },
  };
  return Object.entries(meta).map(([key, m]) => ({ ...m, pages: pages.get(key)?.size ?? 0, records: records.get(key) ?? 0 }));
}

export default function CreditsPage() {
  const rows = sourceRows();
  return (
    <main className="drafting-grid min-h-dvh">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft size={16} /> Timeline map
        </Link>
        <TopControls />
      </div>
      <article className="mx-auto max-w-3xl border-x border-rule bg-panel px-6 py-8">
        <h1 className="font-display text-4xl font-bold">Credits &amp; data sources</h1>
        <p className="mt-3 text-ink-2">
          Every kit, date, price, barcode and spec in Gunpla Universe comes from the open sources below. Nothing is estimated: when no source states
          a value, the app shows it as missing. Each kit page cites the exact source pages and revisions it uses.
        </p>

        <h2 className="mt-8 font-display text-2xl font-bold">Sources</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-widest text-ink-3">
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Used for</th>
                <th className="py-2 pr-3">License</th>
                <th className="py-2 text-right">Pages cited</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-rule align-top">
                  <td className="py-2 pr-3">
                    <a href={r.url} target="_blank" rel="noreferrer" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                      {r.name}
                    </a>
                  </td>
                  <td className="py-2 pr-3 text-ink-2">{r.used}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.license}</td>
                  <td className="py-2 text-right font-mono text-xs">{r.pages.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 font-display text-2xl font-bold">License of this dataset</h2>
        <p className="mt-2 text-ink-2">
          Text and data derived from Gundam Wiki, Gunpla Wiki and Wikipedia are licensed under Creative Commons Attribution-ShareAlike. The derived
          catalog is offered under the same terms (CC BY-SA 4.0):{" "}
          <a href="/data/catalog.json" className="underline underline-offset-4">
            download catalog.json
          </a>{" "}
          ({catalog.suits.length.toLocaleString("en-US")} suits, {catalog.releases.length.toLocaleString("en-US")} releases, generated{" "}
          {catalog.generatedAt.slice(0, 10)}).
        </p>

        <h2 className="mt-8 font-display text-2xl font-bold">Not used</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
          <li>Box art and product photos (Bandai copyright). Kit tiles show schematic plates instead.</li>
          <li>Sites that refuse automated access: bandai-hobby.net, HobbySearch, Surugaya. They appear only as plain search links.</li>
          <li>Estimated build scores (stability, articulation, part counts, build time). These were removed because no source states them per kit.</li>
        </ul>

        <h2 className="mt-8 font-display text-2xl font-bold">Trademarks</h2>
        <p className="mt-2 text-sm text-ink-3">
          Gundam, Gunpla and related names are trademarks of Sotsu, Sunrise and BANDAI SPIRITS. Gunpla Universe is an unofficial fan project with no
          affiliation to them or to the sources listed above.
        </p>
      </article>
    </main>
  );
}
