"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { mutate } from "swr";
import { isKeyActive } from "@/lib/swr-active-keys";

/**
 * On every navigation, checks the cheap /api/version endpoint. If it's
 * higher than what we last saw — meaning a write happened somewhere,
 * possibly in another tab/browser, since we last checked — every SWR key
 * needs to end up fresh, but "fresh" is handled differently depending on
 * whether something is actively showing that key right now:
 *
 * - Keys with a mounted subscriber (tracked via useTrackedSWR) get a plain
 *   revalidate: `mutate(matcher)` with no data argument only triggers a
 *   background refetch for active keys and never touches their cached
 *   data, so the page keeps rendering its last-known content until the
 *   fresh data swaps in — no spinner, no unmount/remount.
 * - Keys with no active subscriber get their cached data wiped to
 *   `undefined` instead (`mutate(matcher, undefined, { revalidate: false })`).
 *   Since revalidateIfStale is off globally, a hook that mounts later would
 *   otherwise just serve the stale cached data forever; only `undefined`
 *   data forces that future mount to fetch fresh regardless of
 *   revalidateIfStale.
 *
 * Splitting the two is what makes a cross-tab/cross-user change land as
 * smoothly on the currently-viewed page as a self-made edit does, while
 * still guaranteeing any page visited later is correct too.
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
          // Active keys: smooth background revalidate, data stays put.
          mutate((key) => typeof key === "string" && isKeyActive(key));
          // Inactive keys: wipe so a future mount is forced to refetch.
          mutate(
            (key) => typeof key === "string" && !isKeyActive(key),
            undefined,
            { revalidate: false },
          );
        }
        lastVersion.current = data.version;
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
