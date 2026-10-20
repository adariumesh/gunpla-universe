"use client";

import { X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

/** Right-side panel on desktop, bottom sheet on mobile. */
export function KitDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const mq = matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <motion.div className="absolute inset-0 bg-ink/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} aria-hidden />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`absolute flex flex-col overflow-hidden border-rule bg-panel shadow-2xl outline-none ${
          mobile ? "inset-x-0 bottom-0 h-[92dvh] rounded-t-2xl border-t" : "inset-y-0 right-0 w-[min(40rem,92vw)] border-l"
        }`}
        initial={mobile ? { y: "100%" } : { x: "100%" }}
        animate={mobile ? { y: 0 } : { x: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
      >
        {mobile && <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-rule" />}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close kit details"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-md border border-rule bg-panel text-ink-2 hover:text-ink"
        >
          <X size={18} />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </motion.div>
    </div>
  );
}
