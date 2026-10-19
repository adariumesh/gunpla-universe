"use client";

import { Search } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { MockBadge } from "./Glyph";

export const OPEN_PALETTE_EVENT = "gu:open-palette";

export function SearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
      className="flex h-9 items-center gap-2 rounded-md border border-rule bg-panel px-3 text-sm text-ink-2 hover:text-ink"
    >
      <Search size={15} aria-hidden />
      <span className="hidden sm:inline">Search suits &amp; kits</span>
      <kbd className="hidden rounded border border-rule px-1 font-mono text-[10px] text-ink-3 sm:inline">⌘K</kbd>
    </button>
  );
}

export function TopControls({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <a href="/credits" className="mr-1 hidden lg:inline-flex" title="Credits and data sources">
        <MockBadge />
      </a>
      <SearchButton />
      <ThemeToggle />
    </div>
  );
}
