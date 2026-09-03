"use client";

import { useState } from "react";
import { mutate } from "swr";

type Row = { id: number; paid: boolean; paidAt: string | null };

/**
 * Shared "select rows, mark paid/unpaid" logic for the Session and Player
 * detail views: a checked-id Set plus a setPaid mutation that PATCHes each
 * attendance, optimistically updates the own list, and revalidates the
 * overview/sessions summaries and every sibling list the change affects
 * (e.g. marking a session's attendance paid also affects that player's own
 * attendance list, and vice versa).
 */
export function useAttendanceMutations<T extends Row>(
  key: string | null,
  rows: T[],
  siblingKeyOf: (row: T) => string,
) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggleCheck(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function setPaid(ids: number[], paid: boolean) {
    const siblingKeys = new Set(
      rows.filter((r) => ids.includes(r.id)).map(siblingKeyOf),
    );
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/attendances/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paid }),
        }),
      ),
    );
    mutate(
      key,
      (curr: { attendances: T[] } | undefined) =>
        curr && {
          attendances: curr.attendances.map((r) =>
            ids.includes(r.id)
              ? { ...r, paid, paidAt: paid ? new Date().toISOString() : null }
              : r,
          ),
        },
      { revalidate: false },
    );
    setChecked(new Set());
    // Instant same-tab refresh of Overview/Sessions/Players balances.
    mutate("/api/overview");
    mutate("/api/sessions");
    for (const sk of siblingKeys) mutate(sk);
  }

  return { checked, setChecked, toggleCheck, setPaid };
}
