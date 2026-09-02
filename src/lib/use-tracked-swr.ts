"use client";

import { useEffect } from "react";
import useSWR, { type SWRResponse } from "swr";
import { markKeyActive, markKeyInactive } from "./swr-active-keys";

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
    return () => markKeyInactive(key);
  }, [key]);
  return useSWR<Data>(key);
}
