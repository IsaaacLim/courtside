"use client";

import { useEffect, useMemo, useState } from "react";
import type { Player } from "@/db/schema";
import { formatCents } from "@/lib/money";

type AttendanceRow = {
  id: number;
  sessionId: number;
  date: string;
  amountDue: number;
  paid: boolean;
  paidAt: string | null;
  method: string | null;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PaymentsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((d) => setPlayers(d.players ?? []));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, search]);

  async function openPlayer(p: Player) {
    setSelectedPlayer(p);
    setChecked(new Set());
    setLoadingRows(true);
    const res = await fetch(`/api/attendances?playerId=${p.id}`);
    const data = await res.json();
    setRows(data.attendances ?? []);
    setLoadingRows(false);
  }

  async function setPaid(ids: number[], paid: boolean) {
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/attendances/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paid }),
        }),
      ),
    );
    // Optimistically update local state.
    setRows((prev) =>
      prev.map((r) =>
        ids.includes(r.id)
          ? { ...r, paid, paidAt: paid ? new Date().toISOString() : null }
          : r,
      ),
    );
    setChecked(new Set());
  }

  const unpaid = rows.filter((r) => !r.paid);
  const paid = rows.filter((r) => r.paid);
  const outstanding = unpaid.reduce((sum, r) => sum + r.amountDue, 0);
  const checkedTotal = unpaid
    .filter((r) => checked.has(r.id))
    .reduce((sum, r) => sum + r.amountDue, 0);

  function toggleCheck(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!selectedPlayer) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-4">Payments</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a player"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 mb-3"
          autoFocus
        />
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-neutral-400">No players.</li>
          ) : (
            filtered.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => openPlayer(p)}
                  className="w-full text-left px-3 py-3"
                >
                  {p.name}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setSelectedPlayer(null)}
        className="text-blue-600 text-sm mb-3"
      >
        ← All players
      </button>
      <h1 className="text-xl font-bold">{selectedPlayer.name}</h1>
      <p className="text-neutral-500 mb-4">
        Outstanding{" "}
        <span
          className={
            outstanding > 0 ? "text-red-600 font-semibold" : "text-green-600"
          }
        >
          {formatCents(outstanding)}
        </span>
      </p>

      {loadingRows ? (
        <p className="text-neutral-400">Loading…</p>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-neutral-500 mb-2">
            Unpaid ({unpaid.length})
          </h2>
          {unpaid.length === 0 ? (
            <p className="text-neutral-400 mb-6">All settled. 🎉</p>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white mb-3">
              {unpaid.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-3"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(r.id)}
                    onChange={() => toggleCheck(r.id)}
                    className="h-5 w-5"
                  />
                  <div className="flex-1">
                    <div>{fmtDate(r.date)}</div>
                    <div className="text-sm text-neutral-500">
                      {formatCents(r.amountDue)}
                    </div>
                  </div>
                  <button
                    onClick={() => setPaid([r.id], true)}
                    className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium"
                  >
                    Paid
                  </button>
                </li>
              ))}
            </ul>
          )}

          {checked.size > 0 && (
            <button
              onClick={() => setPaid([...checked], true)}
              className="w-full rounded-lg bg-green-600 text-white py-3 font-medium mb-6"
            >
              Mark {checked.size} paid · {formatCents(checkedTotal)}
            </button>
          )}

          {paid.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-neutral-500 mb-2">
                Paid ({paid.length})
              </h2>
              <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
                {paid.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between px-3 py-3"
                  >
                    <div>
                      <div className="text-neutral-500">{fmtDate(r.date)}</div>
                      <div className="text-sm text-neutral-400">
                        {formatCents(r.amountDue)}
                      </div>
                    </div>
                    <button
                      onClick={() => setPaid([r.id], false)}
                      className="text-neutral-400 text-sm"
                    >
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
