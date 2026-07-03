"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExpandId = string | number;
type NudgeState = { id: ExpandId | null; y: number };

/**
 * Manages the tapped-row "nudge": the row's label drifts toward where the
 * detail header will settle, then the detail opens shortly after.
 */
export function useExpandNudge() {
  const [nudge, setNudge] = useState<NudgeState>({ id: null, y: 0 });

  // Nudge the label first, then run `open` (e.g. set the selected item).
  function requestOpen(id: ExpandId, y: number, open: () => void) {
    setNudge({ id, y });
    window.setTimeout(open, 120);
  }

  function reset() {
    setNudge({ id: null, y: 0 });
  }

  return { nudge, requestOpen, reset };
}

/**
 * A list row that morphs into the detail overlay. The morphing surface has no
 * children (so nothing distorts); the content sits on top and, while its
 * detail is open, nudges toward the header and hides.
 */
export function ExpandTrigger({
  layoutId,
  nudge,
  onOpen,
  className,
  children,
}: {
  layoutId: ExpandId;
  nudge: NudgeState;
  onOpen: (y: number) => void;
  className?: string;
  children: ReactNode;
}) {
  const leaving = nudge.id === layoutId;
  return (
    // `layout="position"` animates the whole row (border + text) together when
    // the list reorders/filters, instead of only the surface sliding.
    <motion.div layout="position" className="relative">
      <motion.div
        layoutId={`expand-${layoutId}`}
        // While opening, this surface is the shared element Framer may animate;
        // elevate it above the FAB/nav/header so it never renders behind them
        // mid-expand.
        style={{ zIndex: leaving ? 50 : undefined }}
        // Fade the border out as it expands (it would otherwise scale into a
        // thick frame) and back in as it collapses.
        className={cn(
          "absolute inset-0 rounded-lg border bg-raised transition-[border-color] duration-200",
          leaving ? "border-transparent" : "border-border",
        )}
      />
      <button
        type="button"
        onClick={(e) => {
          // Nudge toward where the header settles (~72px from the top): up when
          // the row is below that point, down when above.
          const y = e.currentTarget.getBoundingClientRect().top > 72 ? -12 : 12;
          onOpen(y);
        }}
        style={{
          transition: "transform 160ms ease-out, opacity 160ms ease-out",
          transform: leaving ? `translateY(${nudge.y}px)` : "translateY(0)",
          opacity: leaving ? 0 : 1,
          // Keep the label above the elevated surface so it can nudge + fade
          // instead of being instantly covered.
          zIndex: leaving ? 50 : undefined,
        }}
        className={cn(
          "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted/50",
          className,
        )}
      >
        {children}
      </button>
    </motion.div>
  );
}

/**
 * Full-screen detail overlay that expands from the matching ExpandTrigger and
 * collapses back into it. Locks the underlying page scroll while open.
 */
export function ExpandOverlay({
  open,
  layoutId,
  children,
}: {
  open: boolean;
  layoutId: ExpandId;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Solid surface morphs out of the tapped row (above the FAB) and
          collapses back into it. No children, so nothing distorts. */}
      {open && (
        <motion.div
          layoutId={`expand-${layoutId}`}
          className="fixed inset-0 z-50 bg-background"
        />
      )}

      {/* Content fades in after the surface expands, and on close drifts
          slightly downward and fades away. */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="expand-content"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { delay: 0.22, duration: 0.28 },
            }}
            exit={{
              opacity: 0,
              y: 20,
              transition: { duration: 0.1, ease: "easeIn" },
            }}
            className="fixed inset-0 z-50 overflow-y-auto"
          >
            <div className="mx-auto max-w-2xl space-y-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Sticky top bar for a detail overlay: back button on the left, optional actions on the right. */
export function ExpandBackBar({
  onBack,
  actions,
}: {
  onBack: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-background px-4 pt-3 pb-2">
      <Button variant="ghost" size="sm" onClick={onBack} className="px-0">
        <ArrowLeft className="size-6" />
      </Button>
      {actions}
    </div>
  );
}
