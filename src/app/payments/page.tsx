"use client";

import { useEffect, useMemo, useState } from "react";
import type { Player } from "@/db/schema";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

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
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a player"
          className="mb-3"
          autoFocus
        />
        <ul className="divide-y divide-border rounded-lg border bg-card overflow-hidden">
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-muted-foreground">No players.</li>
          ) : (
            filtered.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => openPlayer(p)}
                  className="w-full text-left px-3 py-3 hover:bg-accent transition-colors"
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
      <Button
        variant="link"
        onClick={() => setSelectedPlayer(null)}
        className="px-0 h-auto mb-3"
      >
        ← All players
      </Button>
      <h1 className="text-xl font-bold">{selectedPlayer.name}</h1>
      <p className="text-muted-foreground mb-4">
        Outstanding{" "}
        <span
          className={
            outstanding > 0
              ? "text-red-600 dark:text-red-400 font-semibold"
              : "text-green-600 dark:text-green-400"
          }
        >
          {formatCents(outstanding)}
        </span>
      </p>

      {loadingRows ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">
            Unpaid ({unpaid.length})
          </h2>
          {unpaid.length === 0 ? (
            <p className="text-muted-foreground mb-6">All settled. 🎉</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border bg-card mb-3">
              {unpaid.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-3">
                  <Checkbox
                    checked={checked.has(r.id)}
                    onCheckedChange={() => toggleCheck(r.id)}
                    className="size-5"
                  />
                  <div className="flex-1">
                    <div>{fmtDate(r.date)}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCents(r.amountDue)}
                    </div>
                  </div>
                  <Button
                    onClick={() => setPaid([r.id], true)}
                    className="bg-green-600 hover:bg-green-700 text-white h-9 px-4"
                  >
                    Paid
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {checked.size > 0 && (
            <Button
              onClick={() => setPaid([...checked], true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white h-11 text-base mb-6"
            >
              Mark {checked.size} paid · {formatCents(checkedTotal)}
            </Button>
          )}

          {paid.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                Paid ({paid.length})
              </h2>
              <ul className="divide-y divide-border rounded-lg border bg-card">
                {paid.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between px-3 py-3"
                  >
                    <div>
                      <div className="text-muted-foreground">
                        {fmtDate(r.date)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCents(r.amountDue)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPaid([r.id], false)}
                      className="text-muted-foreground"
                    >
                      Undo
                    </Button>
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
