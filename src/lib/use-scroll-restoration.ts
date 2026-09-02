"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * With cacheComponents, Next.js keeps recently-visited routes mounted
 * (hidden via Activity) instead of unmounting them, but window scroll is
 * global — hiding one route and showing another doesn't restore each
 * route's own offset on its own. This does that: a ref (which Activity
 * preserves across hide/show, unlike plain unmount) tracks this page's own
 * scroll position continuously, and reapplies it every time this page
 * becomes visible again.
 */
export function useScrollRestoration() {
  const savedScroll = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      savedScroll.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Layout effect so the jump happens before paint, matching Activity's own
  // hide/show timing (avoids a flash at the top before snapping back down).
  useLayoutEffect(() => {
    window.scrollTo(0, savedScroll.current);
  }, []);
}
