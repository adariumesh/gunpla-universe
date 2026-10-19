"use client";

import { AnimatePresence, motion } from "motion/react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchEntry } from "@/lib/repo";
import { OPEN_PALETTE_EVENT } from "./TopControls";
import { withBase } from "@/lib/basePath";

/** Search index (~4k suits and kits) is fetched on first open, not shipped with every page. */
export function CommandPalette() {
  const router = useRouter();
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open && !entries.length)
      fetch(withBase("/api/search"))
        .then((r) => r.json())
        .then(setEntries)
        .catch(() => {});
  }, [open, entries.length]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = terms.length
      ? entries.filter((e) => terms.every((t) => `${e.label} ${e.sub} ${e.id}`.toLowerCase().includes(t)))
      : entries.filter((e) => e.kind === "suit").slice(0, 40);
    return hits.slice(0, 40);
  }, [q, entries]);

  const choose = (e: SearchEntry | undefined) => {
    if (!e) return;
    setOpen(false);
    router.push(e.href);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 px-4 pt-[12vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search suits and kits"
            className="w-full max-w-xl overflow-hidden rounded-lg border border-rule bg-panel shadow-2xl"
            initial={{ y: -12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -12, scale: 0.98 }}
          >
            <div className="flex items-center gap-3 border-b border-rule px-4">
              <Search size={16} className="text-ink-3" aria-hidden />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
                  if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
                  if (e.key === "Enter") choose(results[active]);
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="RX-78-2, Sazabi, Ver.Ka, RG…"
                className="h-12 w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-results"
                aria-activedescendant={results[active] ? `pal-${results[active].kind}-${results[active].id}` : undefined}
              />
              <kbd className="font-mono text-[10px] text-ink-3">ESC</kbd>
            </div>
            <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
              {results.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-ink-3">{entries.length ? "No match. Haro: NOT FOUND! NOT FOUND!" : "Loading index…"}</li>
              )}
              {results.map((r, i) => (
                <li
                  key={`${r.kind}-${r.id}`}
                  id={`pal-${r.kind}-${r.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-2 text-sm ${i === active ? "bg-paper-2" : ""}`}
                >
                  <span className="truncate text-ink">{r.label}</span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-3">
                    {r.kind === "suit" ? "SUIT" : "KIT"} · {r.sub}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
