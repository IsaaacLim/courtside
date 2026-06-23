"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/db/schema";

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(
      `/api/players?includeInactive=${includeInactive ? "1" : "0"}`,
    );
    const data = await res.json();
    setPlayers(data.players ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    await fetch("/api/players", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    load();
  }

  async function rename(p: Player) {
    const name = prompt("Rename player", p.name);
    if (!name || name.trim() === p.name) return;
    await fetch(`/api/players/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    load();
  }

  async function toggleActive(p: Player) {
    await fetch(`/api/players/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    load();
  }

  async function merge(p: Player) {
    const others = players.filter((x) => x.id !== p.id);
    const target = prompt(
      `Merge "${p.name}" INTO which player? Enter exact name.\n\n` +
        others.map((o) => `• ${o.name}`).join("\n"),
    );
    if (!target) return;
    const match = others.find(
      (o) => o.name.toLowerCase() === target.trim().toLowerCase(),
    );
    if (!match) {
      alert("No player with that exact name.");
      return;
    }
    if (
      !confirm(
        `Merge "${p.name}" into "${match.name}"? All of ${p.name}'s sessions move to ${match.name}, and ${p.name} is deleted.`,
      )
    )
      return;
    await fetch(`/api/players/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mergeIntoId: match.id }),
    });
    load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Players</h1>

      <form onSubmit={addPlayer} className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a player"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 font-medium disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <label className="flex items-center gap-2 text-sm text-neutral-600 mb-3">
        <input
          type="checkbox"
          checked={includeInactive}
          onChange={(e) => setIncludeInactive(e.target.checked)}
        />
        Show inactive
      </label>

      {loading ? (
        <p className="text-neutral-400">Loading…</p>
      ) : players.length === 0 ? (
        <p className="text-neutral-400">No players yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between px-3 py-3"
            >
              <span className={p.active ? "" : "text-neutral-400 line-through"}>
                {p.name}
              </span>
              <div className="flex gap-3 text-sm">
                <button
                  onClick={() => rename(p)}
                  className="text-blue-600"
                >
                  Rename
                </button>
                <button
                  onClick={() => merge(p)}
                  className="text-neutral-500"
                >
                  Merge
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  className="text-neutral-500"
                >
                  {p.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
