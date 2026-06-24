"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Player } from "@/db/schema";
import { formatCents, parseDollarsToCents } from "@/lib/money";

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function NewSessionPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [date, setDate] = useState(todayStr());
  const [rate, setRate] = useState(""); // dollar string
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadPlayers() {
    const res = await fetch("/api/players");
    const data = await res.json();
    setPlayers(data.players ?? []);
  }

  useEffect(() => {
    loadPlayers();
    fetch("/api/sessions/last-rate")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.rate === "number") setRate((d.rate / 100).toString());
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, search]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addAndSelect() {
    const name = search.trim();
    if (!name) return;
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.player) {
      setPlayers((prev) =>
        [...prev, data.player].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSelected((prev) => new Set(prev).add(data.player.id));
      setSearch("");
    }
  }

  const exactExists = players.some(
    (p) => p.name.toLowerCase() === search.trim().toLowerCase(),
  );
  const canAddNew = search.trim().length > 0 && !exactExists;

  async function submit() {
    setError("");
    const cents = parseDollarsToCents(rate);
    if (cents === null) {
      setError("Enter a valid rate.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one player.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, rate: cents, playerIds: [...selected] }),
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not create session.");
    }
  }

  const cents = parseDollarsToCents(rate);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">New session</h1>

      <div className="flex gap-3 mb-4">
        <label className="flex-1">
          <span className="block text-sm text-neutral-500 mb-1">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="w-32">
          <span className="block text-sm text-neutral-500 mb-1">Rate ($)</span>
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            defaultValue={10.00}
            onChange={(e) => setRate(e.target.value)}
            placeholder="10.00"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-neutral-500">
          {selected.size} selected
        </span>
        {cents !== null && selected.size > 0 && (
          <span className="text-sm text-neutral-500">
            Total {formatCents(cents * selected.size)}
          </span>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search or add a player"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 mb-2"
      />

      {canAddNew && (
        <button
          onClick={addAndSelect}
          className="w-full text-left rounded-lg border border-dashed border-blue-400 text-blue-600 px-3 py-2 mb-2"
        >
          + Add &ldquo;{search.trim()}&rdquo; as a new player
        </button>
      )}

      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white mb-4">
        {filtered.length === 0 ? (
          <li className="px-3 py-3 text-neutral-400">No players.</li>
        ) : (
          filtered.map((p) => {
            const on = selected.has(p.id);
            return (
              <li key={p.id}>
                <button
                  onClick={() => toggle(p.id)}
                  className="w-full flex items-center justify-between px-3 py-3 text-left"
                >
                  <span>{p.name}</span>
                  <span
                    className={`h-6 w-6 rounded-full border flex items-center justify-center text-sm ${
                      on
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "border-neutral-300 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting || selected.size === 0}
        className="w-full rounded-lg bg-blue-600 text-white py-3 font-medium disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create session"}
      </button>
    </div>
  );
}
