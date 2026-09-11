"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { useTrackedSWR } from "@/lib/use-tracked-swr";
import { useScrollRestoration } from "@/lib/use-scroll-restoration";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ListCard, ListRow, ListRowAvatar } from "@/components/list-card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { PlayerEditSheet, type PlayerRow } from "@/components/player-edit-sheet";

export default function PlayersPage() {
  useScrollRestoration();
  const key = "/api/players";
  const { data, isLoading } = useTrackedSWR<{ players: PlayerRow[] }>(key);
  const players = data?.players ?? [];
  const [newName, setNewName] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  // Decrementing counter for optimistic new-player rows: guaranteed unique,
  // never collides with real (positive, autoincrement) player ids.
  const tempIdRef = useRef(0);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setNewName("");

    // Optimistic insert: add a placeholder (negative id) immediately, then
    // swap it for the real player on success or roll it back on failure.
    // While pending, the row is excluded from being tapped into the edit
    // sheet and from the merge-target list (see the `id > 0` guards below) —
    // acting on a placeholder id before it resolves can leave the real
    // created player invisible until a refresh, or worse for merge.
    tempIdRef.current -= 1;
    const tempId = tempIdRef.current;
    const optimisticPlayer: PlayerRow = {
      id: tempId,
      name,
      aliases: [],
      createdAt: new Date(),
      owed: 0,
      sessionCount: 0,
    };
    mutate(
      key,
      (curr: { players: PlayerRow[] } | undefined) => ({
        players: [...(curr?.players ?? []), optimisticPlayer].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }),
      { revalidate: false },
    );

    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data.player) throw new Error();
      mutate(
        key,
        (curr: { players: PlayerRow[] } | undefined) => ({
          players: (curr?.players ?? [])
            .map((p) =>
              p.id === tempId ? { ...data.player, owed: 0, sessionCount: 0 } : p,
            )
            .sort((a, b) => a.name.localeCompare(b.name)),
        }),
        { revalidate: false },
      );
    } catch {
      mutate(
        key,
        (curr: { players: PlayerRow[] } | undefined) => ({
          players: (curr?.players ?? []).filter((p) => p.id !== tempId),
        }),
        { revalidate: false },
      );
      setNewName(name);
      toast.error(`Could not add "${name}". Please try again.`);
    }
  }

  async function renamePlayer(id: number, name: string) {
    await fetch(`/api/players/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    // Broadcast: the name shows up anywhere else it's cached (e.g. an
    // open session's attendance list) without waiting for a navigation.
    mutate(() => true);
  }

  // Optimistic: remove the row from the cache immediately so the sheet/list
  // reflects it with no wait, then fire the request in the background. Any
  // failure re-inserts the row and shows an error, instead of the previous
  // code's unconditional success (it never checked res.ok at all).
  function removePlayerFromCache(id: number) {
    mutate(
      key,
      (curr: { players: PlayerRow[] } | undefined) => ({
        players: (curr?.players ?? []).filter((p) => p.id !== id),
      }),
      { revalidate: false },
    );
  }

  function restorePlayerInCache(target: PlayerRow) {
    mutate(
      key,
      (curr: { players: PlayerRow[] } | undefined) => ({
        players: [...(curr?.players ?? []), target].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }),
      { revalidate: false },
    );
  }

  async function mergePlayers(sourceId: number, targetId: number) {
    const source = players.find((p) => p.id === sourceId);
    removePlayerFromCache(sourceId);

    try {
      const res = await fetch(`/api/players/${sourceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mergeIntoId: targetId }),
      });
      if (!res.ok) throw new Error();
      mutate("/api/overview");
    } catch {
      if (source) restorePlayerInCache(source);
      toast.error(`Could not merge ${source?.name ?? "player"}. Please try again.`);
    }
  }

  async function deletePlayer(target: PlayerRow) {
    removePlayerFromCache(target.id);

    try {
      const res = await fetch(`/api/players/${target.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      mutate("/api/overview");
      toast.success(`${target.name} deleted`);
    } catch {
      restorePlayerInCache(target);
      toast.error(`Could not delete ${target.name}. Please try again.`);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Manage Players" />

      <form onSubmit={addPlayer} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a player"
          className="flex-1"
        />
        <Button type="submit" disabled={!newName.trim()}>
          Add
        </Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : players.length === 0 ? (
        <Empty className="border rounded-xl py-10">
          <EmptyHeader>
            <EmptyTitle>No players yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ListCard>
          {players.map((p) => {
            // Still-pending optimistic add (negative id) — not yet a real
            // player server-side, so it can't be tapped into rename/merge/
            // delete until it resolves.
            const pending = p.id < 0;
            return (
              <div
                key={p.id}
                role="button"
                aria-disabled={pending}
                onClick={() => !pending && setSelectedPlayer(p)}
                className={pending ? "select-none opacity-60" : "cursor-pointer select-none"}
              >
                <ListRow
                  icon={<ListRowAvatar name={p.name} colorKey={String(p.id)} />}
                  title={p.name}
                  chevron={!pending}
                  className="w-full"
                />
              </div>
            );
          })}
        </ListCard>
      )}

      <PlayerEditSheet
        player={selectedPlayer}
        players={players}
        onOpenChange={(o) => !o && setSelectedPlayer(null)}
        onRename={renamePlayer}
        onMerge={mergePlayers}
        onDelete={deletePlayer}
      />
    </div>
  );
}
