import { ExternalLink } from "lucide-react";

/*
 * Plain search links, one query shape per retailer, each tested by hand
 * (2026-10-19, HG IBO 021 Barbatos Lupus, JAN 4573102554468):
 *   - HobbySearch ignores JANs and Bandai's long names, but matches
 *     "<model number> <suit name>"; it also needs its own URL parameters
 *   - HLJ takes `Word=`; a JAN returns the exact kit
 *   - Modelverse (UK) jumps straight to the product page for a JAN; name
 *     searches fail if they include "Bandai" (it lists "Bandai Spirits")
 *   - Amazon serves a bot check for JAN searches; a short name works
 *   - eBay works best with a short name
 * Nothing is fetched from these sites. Swap in affiliate URLs later, keyed
 * by Bandai item code or JAN.
 */

type Props = {
  jan: string | null;
  itemCode?: string;
  /** e.g. "HG", "MG", "RG"; empty for vintage */
  grade: string;
  modelNumber: string;
  suitName: string;
};

const GRADE_WORD: Record<string, string> = { VINTAGE: "", OTHER: "", RE100: "RE/100", FM: "Full Mechanics", EG: "Entry Grade", MEGA: "Mega Size" };

export function RetailerLinks({ jan, itemCode, grade, modelNumber, suitName }: Props) {
  const gradeWord = GRADE_WORD[grade] ?? grade;
  // "Bandai" helps Amazon/eBay skip third-party items but breaks Modelverse ("Bandai Spirits").
  const plainName = [gradeWord, suitName].filter(Boolean).join(" ");
  const shortName = `Bandai ${plainName}`;
  const enc = (q: string) => encodeURIComponent(q).replace(/%20/g, "+");

  const links: { name: string; region: string; href: string; query: string }[] = [
    {
      name: "HLJ",
      region: "JP",
      query: jan ?? plainName,
      href: `https://www.hlj.com/search/?Word=${enc(jan ?? plainName)}`,
    },
    {
      name: "HobbySearch",
      region: "JP",
      query: `${modelNumber} ${suitName}`,
      href: `https://www.1999.co.jp/eng/search?typ1_c=100&cat=&state=&sold=0&sortid=7&searchkey=${enc(`${modelNumber} ${suitName}`)}`,
    },
    {
      name: "Modelverse",
      region: "UK",
      query: jan ?? plainName,
      href: `https://modelverse.co.uk/?s=${enc(jan ?? plainName)}&post_type=product`,
    },
    { name: "Amazon", region: "US", query: shortName, href: `https://www.amazon.com/s?k=${enc(shortName)}` },
    { name: "eBay", region: "Global", query: shortName, href: `https://www.ebay.com/sch/i.html?_nkw=${enc(shortName)}` },
  ];

  return (
    <div>
      <ul className="grid grid-cols-2 gap-2">
        {links.map((l) => (
          <li key={l.name}>
            <a
              href={l.href}
              target="_blank"
              rel="noreferrer nofollow"
              title={`Search ${l.name} for “${l.query}”`}
              className="flex items-center justify-between rounded-md border border-rule px-3 py-2 text-sm hover:border-accent"
            >
              <span>
                {l.name} <span className="font-mono text-[0.6875rem] text-ink-3">{l.region}</span>
              </span>
              <ExternalLink size={13} className="text-ink-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-[0.6875rem] text-ink-3">
        {jan ? "HLJ and Modelverse search by JAN (exact kit); " : ""}HobbySearch, Amazon and eBay search by name, so check the grade in the results
        {itemCode ? ` (Bandai #${itemCode})` : ""}. No prices or stock are tracked; links are not affiliated.
      </p>
      <a
        href={`https://www.reddit.com/r/Gunpla/search/?q=${encodeURIComponent(plainName)}&restrict_sr=1`}
        target="_blank"
        rel="noreferrer nofollow"
        className="mt-3 inline-flex items-center gap-1.5 text-sm underline decoration-rule underline-offset-4 hover:decoration-ink"
      >
        Discuss on r/Gunpla <ExternalLink size={12} aria-hidden />
      </a>
    </div>
  );
}
