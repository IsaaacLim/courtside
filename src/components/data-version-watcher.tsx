"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { mutate } from "swr";
import { getActiveKeys } from "@/lib/swr-active-keys";

/**
 * On every navigation, checks the cheap /api/version endpoint. If it's
 * higher than what we last saw — meaning a write happened somewhere,
 * possibly in another tab/browser, since we last checked — every SWR key
 * needs to end up fresh, but "fresh" is handled differently depending on
 * whether something was showing that key right up until now:
 *
 * - Keys with a mounted subscriber right now, OR that had one continuously
 *   from the previous check until this one (i.e. the page you just
 *   navigated away from), get a plain revalidate: `mutate(matcher)` with no
 *   data argument only triggers a background refetch and never touches
 *   cached data, so whichever of those is on screen keeps rendering its
 *   last-known content until the fresh data swaps in — no spinner, no
 *   unmount/remount. The "just navigated away from" half matters because
 *   the check only runs on navigation: if the version bumped while you were
 *   sitting on a page, the only check that will ever see it is the one that
 *   fires the moment you leave — by which point that page's key is already
 *   inactive. Without also treating it as smooth here, it would get wiped
 *   instead, and coming back to it later would show a spinner for no reason
 *   (nothing changed between leaving and returning).
 * - Every other key gets its cached data wiped to `undefined` instead
 *   (`mutate(matcher, undefined, { revalidate: false })`). Since
 *   revalidateIfStale is off globally, a hook that mounts later would
 *   otherwise just serve the stale cached data forever; only `undefined`
 *   data forces that future mount to fetch fresh regardless of
 *   revalidateIfStale.
 */
export function DataVersionWatcher() {
  const pathname = usePathname();
  const lastVersion = useRef<number | null>(null);
  // Keys active as of the end of the previous check — carried forward so a
  // version change discovered exactly as a page becomes inactive still
  // treats that page as smooth-eligible.
  const previouslyActive = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (pathname === "/login") return;
    let cancelled = false;
    fetch("/api/version")
      .then((r) => r.json())
      .then((data: { version: number }) => {
        if (cancelled) return;
        // Read active keys only now, after the network round trip — by this
        // point the page we just navigated to has had its own mount effect
        // (useTrackedSWR's markKeyActive) run, since that's synchronous and
        // this is not. Reading it synchronously at the top of this effect
        // would miss it, since DataVersionWatcher's effect fires before the
        // newly-mounted page's.
        const currentlyActive = getActiveKeys();
        if (
          lastVersion.current !== null &&
          lastVersion.current !== data.version
        ) {
          const smooth = new Set([
            ...currentlyActive,
            ...previouslyActive.current,
          ]);
          mutate((key) => typeof key === "string" && smooth.has(key));
          mutate(
            (key) => typeof key === "string" && !smooth.has(key),
            undefined,
            { revalidate: false },
          );
        }
        lastVersion.current = data.version;
        previouslyActive.current = currentlyActive;
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
