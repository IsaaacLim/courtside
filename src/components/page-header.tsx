"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Pixels of scroll over which the header collapses. Matches `main`'s top
// padding (pt-24 = 6rem = 96px) so the title finishes collapsing at the exact
// moment it sticks to the top of the viewport.
const COLLAPSE_DISTANCE = 96;

export function PageHeader({
  title,
  actions,
  leading,
  className,
}: {
  title: ReactNode;
  /** Rendered on the right of the title row (e.g. a badge). */
  actions?: ReactNode;
  /** Rendered above the title (e.g. a back button). */
  leading?: ReactNode;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const next = Math.min(1, Math.max(0, window.scrollY / COLLAPSE_DISTANCE));
      setProgress(next);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Shrink the title from 2rem (32px) down to 1.5rem (24px).
  const fontSize = 2 - 0.5 * progress;
  // Fade the title colour toward the primary foreground as the bar fills in.
  const titleColor = `color-mix(in oklab, var(--foreground), var(--primary-foreground) ${progress * 100}%)`;

  return (
    <div className={cn("sticky top-0 z-20 -mx-4", className)}>
      {/* Primary background fades in proportionally to scroll. It bleeds
          upward by COLLAPSE_DISTANCE so it always reaches the top of the
          viewport — no light strip is left in the gap the header scrolls
          through before it sticks. */}
      <div
        className="absolute inset-x-0 bottom-0 bg-primary shadow-sm"
        style={{ top: -COLLAPSE_DISTANCE, opacity: progress }}
        aria-hidden
      />
      <div className="relative px-4 pt-6 pb-2">
        {leading && <div className="mb-1">{leading}</div>}
        <div className="flex items-center justify-between gap-3">
          <h1
            className="font-bold leading-tight"
            style={{ fontSize: `${fontSize}rem`, color: titleColor }}
          >
            {title}
          </h1>
          {actions}
        </div>
      </div>
    </div>
  );
}
