import { ExternalLink } from "lucide-react";

/*
 * Plain search links built from the kit's official name. No prices or stock are
 * shown or simulated, and none of these retailers is queried by the app. When
 * affiliate programs are set up, swap these URLs for affiliate ones keyed by the
 * Bandai item code (preferred) or JAN.
 */

const RETAILERS: { name: string; region: string; url: (q: string) => string }[] = [
  { name: "HobbySearch", region: "JP", url: (q) => `https://www.1999.co.jp/eng/search?searchkey=${encodeURIComponent(q)}` },
  { name: "HLJ", region: "JP", url: (q) => `https://www.hlj.com/search/?q=${encodeURIComponent(q)}` },
  { name: "Amazon", region: "US", url: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
  { name: "eBay", region: "Global", url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}` },
];

export function RetailerLinks({ name, itemCode, jan }: { name: string; itemCode?: string; jan: string | null }) {
  // A JAN is the most precise search term retailers accept; otherwise the official name.
  const query = jan ?? name;
  return (
    <div>
      <ul className="grid grid-cols-2 gap-2">
        {RETAILERS.map((r) => (
          <li key={r.name}>
            <a
              href={r.url(query)}
              target="_blank"
              rel="noreferrer nofollow"
              className="flex items-center justify-between rounded-md border border-rule px-3 py-2 text-sm hover:border-accent"
            >
              <span>
                {r.name} <span className="font-mono text-[10px] text-ink-3">{r.region}</span>
              </span>
              <ExternalLink size={13} className="text-ink-3" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-[10px] text-ink-3">
        Searches for “{query}”{itemCode ? ` (Bandai #${itemCode})` : ""}. No prices or stock are tracked; links are not affiliated.
      </p>
      <a
        href={`https://www.reddit.com/r/Gunpla/search/?q=${encodeURIComponent(name)}&restrict_sr=1`}
        target="_blank"
        rel="noreferrer nofollow"
        className="mt-3 inline-flex items-center gap-1.5 text-sm underline decoration-rule underline-offset-4 hover:decoration-ink"
      >
        Discuss on r/Gunpla <ExternalLink size={12} aria-hidden />
      </a>
    </div>
  );
}
