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

export function isKeyActive(key: string): boolean {
  return counts.has(key);
}
