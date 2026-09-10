"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps a scrollable list with fading gradient overlays at the top/bottom
 * edges, shown only while there's more content to scroll to in that
 * direction — signals "there's more" without a visible scrollbar.
 *
 * `scrollDeps` should include anything that changes the list's content
 * height without a scroll event firing (e.g. a search filter), so the
 * fades re-evaluate correctly on mount and after such changes.
 */
export function ScrollShadowList({
  containerClassName,
  scrollClassName,
  scrollDeps = [],
  children,
}: {
  containerClassName?: string;
  scrollClassName?: string;
  scrollDeps?: React.DependencyList;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState({ top: false, bottom: false });

  function update() {
    const el = ref.current;
    if (!el) return;
    setShadow({
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  }

  useEffect(() => {
    update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, scrollDeps);

  return (
    <div className={cn("relative", containerClassName)}>
      <div
        ref={ref}
        onScroll={update}
        className={cn("overflow-y-auto rounded-2xl", scrollClassName)}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-2xl bg-linear-to-b from-black/4 to-transparent transition-opacity",
          shadow.top ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-linear-to-t from-black/4 to-transparent transition-opacity",
          shadow.bottom ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
