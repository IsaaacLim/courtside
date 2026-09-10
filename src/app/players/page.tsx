"use client";

import { useState } from "react";
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

// TEMPORARY: the roster still has inactive players left over from the old
// deactivate feature. Show them here so they can be reviewed and hard
// deleted. Once the roster is clean, delete this constant and the
// `includeInactive` query param (in both this file and the API route) —
// there's no more "inactive" state to show once deactivate is gone for good.
const SHOW_INACTIVE_PLAYERS = true;

export default function PlayersPage() {
  useScrollRestoration();
  const key = `/api/players?includeInactive=${SHOW_INACTIVE_PLAYERS ? "1" : "0"}`;
  const { data, isLoading } = useTrackedSWR<{ players: PlayerRow[] }>(key);
  const players = data?.players ?? [];
  const [newName, setNewName] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);

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
    mutate(key);
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

  async function mergePlayers(sourceId: number, targetId: number) {
    await fetch(`/api/players/${sourceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mergeIntoId: targetId }),
    });
    mutate(key);
  }

  async function deletePlayer(target: PlayerRow) {
    await fetch(`/api/players/${target.id}`, { method: "DELETE" });
    mutate(key);
    mutate("/api/overview");
    toast.success(`${target.name} deleted`);
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
          {players.map((p) => (
            <div
              key={p.id}
              role="button"
              onClick={() => setSelectedPlayer(p)}
              className="cursor-pointer select-none"
            >
              <ListRow
                icon={<ListRowAvatar name={p.name} colorKey={String(p.id)} />}
                title={
                  <span
                    className={p.active ? "" : "text-muted-foreground line-through"}
                  >
                    {p.name}
                  </span>
                }
                chevron
                className="w-full"
              />
            </div>
          ))}
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
