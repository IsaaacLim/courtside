"use client";

import { useEffect, useRef } from "react";

const EVENT = "data:changed";

/** Broadcast that server data changed so mounted pages can refetch. */
export function notifyDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

/**
 * Run `onRefresh` whenever data changes elsewhere in the app (e.g. a new
 * session created from the global drawer). The latest callback is always used,
 * so callers don't need to memoize it.
 */
export function useDataRefresh(onRefresh: () => void) {
  const ref = useRef(onRefresh);

  useEffect(() => {
    ref.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
}
