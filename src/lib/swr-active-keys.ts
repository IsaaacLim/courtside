// Tracks which SWR keys currently have a mounted subscriber, mirroring SWR's
// own internal (unexported) subscriber bookkeeping. DataVersionWatcher needs
// this to tell "revalidate smoothly, someone's looking at this right now"
// apart from "nobody's looking, just mark it stale for next time" — SWR's
// public mutate() API doesn't expose that distinction on its own.
const counts = new Map<string, number>();

export function markKeyActive(key: string | null | undefined) {
  if (!key) return;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

export function markKeyInactive(key: string | null | undefined) {
  if (!key) return;
  const next = (counts.get(key) ?? 1) - 1;
  if (next <= 0) counts.delete(key);
  else counts.set(key, next);
}

export function getActiveKeys(): Set<string> {
  return new Set(counts.keys());
}

// Keys that changed while nobody had them mounted, so a smooth revalidate at
// that moment would've been a silent no-op (mutate() only revalidates keys
// with an active subscriber). Flagged here instead, so whichever mount
// happens next — via useTrackedSWR — can force the revalidate at a point
// where it will actually do something.
const staleKeys = new Set<string>();

export function markKeysStale(keys: Iterable<string>) {
  for (const key of keys) staleKeys.add(key);
}

export function consumeStale(key: string | null | undefined): boolean {
  if (!key) return false;
  return staleKeys.delete(key);
}
