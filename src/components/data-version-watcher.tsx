"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { mutate } from "swr";

/**
 * On every navigation, checks the cheap /api/version endpoint. If it's
 * higher than what we last saw — meaning a write happened somewhere,
 * possibly in another tab/browser, since we last checked — every
 * SWR-cached entry is cleared AND, for whichever key(s) are actively
 * mounted right now, immediately refetched. Passing `undefined` as the
 * data argument (rather than omitting it) is what makes a single
 * `mutate()` call do both: it's the difference between "just revalidate
 * active subscribers" and "overwrite every matched cache entry, then
 * revalidate active subscribers." The overwrite half matters because a
 * plain revalidate only reaches keys with an active subscriber *right
 * now* — a page you land on later, after this check already advanced
 * past the version bump, would otherwise never get the memo. Clearing
 * its cache entry means that later mount sees no data and fetches fresh
 * regardless of `revalidateIfStale`. So every page — the current one and
 * any visited afterward — is guaranteed fresh exactly once after a real
 * change, with no polling in between.
 */
export function DataVersionWatcher() {
  const pathname = usePathname();
  const lastVersion = useRef<number | null>(null);

  useEffect(() => {
    if (pathname === "/login") return;
    let cancelled = false;
    fetch("/api/version")
      .then((r) => r.json())
      .then((data: { version: number }) => {
        if (cancelled) return;
        if (
          lastVersion.current !== null &&
          lastVersion.current !== data.version
        ) {
          mutate(() => true, undefined, { revalidate: true });
        }
        lastVersion.current = data.version;
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
