import { preload } from "swr";
import { fetcher } from "./fetcher";

/**
 * Kick off a request for `key` and seed SWR's cache with it, so a
 * useTrackedSWR(key) that mounts moments later (e.g. once a detail overlay
 * opens) finds the data already in flight or resolved instead of starting
 * its own fetch from zero.
 */
export function prefetch(key: string) {
  preload(key, fetcher);
}
