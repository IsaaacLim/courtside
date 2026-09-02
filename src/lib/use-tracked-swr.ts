"use client";

import { useEffect } from "react";
import useSWR, { mutate, type SWRResponse } from "swr";
import { markKeyActive, markKeyInactive, consumeStale } from "./swr-active-keys";

/**
 * Drop-in replacement for useSWR(key) that also registers the key in
 * swr-active-keys while mounted, so DataVersionWatcher can revalidate
 * currently-viewed keys smoothly instead of wiping their cached data.
 */
export function useTrackedSWR<Data = unknown>(
  key: string | null,
): SWRResponse<Data> {
  useEffect(() => {
    markKeyActive(key);
    // A version change may have been discovered while this key had nobody
    // watching it — that revalidate attempt was flagged rather than run
    // (it would've been a no-op). Now that we're mounting, run it for real.
    if (consumeStale(key)) mutate(key);
    return () => markKeyInactive(key);
  }, [key]);
  return useSWR<Data>(key);
}
