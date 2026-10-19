"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { withBase } from "@/lib/basePath";
import type { KitDetail } from "@/lib/repo";
import { KitDetailView } from "./KitDetailView";
import { KitDrawer } from "./KitDrawer";

/**
 * Opens the kit drawer for `?kit=<key>` on the current page. Kit data comes from the
 * pre-rendered /kit-data/<key> file, so this works on static hosting too.
 */
export function KitDrawerHost() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const kitId = params.get("kit");
  const [state, setState] = useState<{ id: string; detail?: KitDetail; error?: boolean } | null>(null);

  useEffect(() => {
    if (!kitId) {
      setState(null);
      return;
    }
    let alive = true;
    setState((s) => (s?.id === kitId ? s : { id: kitId }));
    fetch(withBase(`/kit-data/${encodeURIComponent(kitId)}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((detail: KitDetail) => alive && setState({ id: kitId, detail }))
      .catch(() => alive && setState({ id: kitId, error: true }));
    return () => {
      alive = false;
    };
  }, [kitId]);

  // Replace rather than go back: a shared ?kit= link has no in-site history to return to.
  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("kit");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [params, pathname, router]);

  if (!kitId || !state) return null;
  return (
    <KitDrawer title={state.detail?.card.sku.name ?? "Kit details"} onClose={close}>
      {state.detail ? (
        <KitDetailView detail={state.detail} asDrawer />
      ) : state.error ? (
        <p className="p-6 text-sm text-warn">Couldn&rsquo;t load this kit.</p>
      ) : (
        <div className="space-y-3 p-6" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-paper-2" />
          ))}
        </div>
      )}
    </KitDrawer>
  );
}
