"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Player } from "@/db/schema";
import { useDataRefresh } from "@/hooks/use-data-refresh";
import { PageHeader } from "@/components/page-header";
import { PlayerDetail } from "@/components/player-detail";
import {
  ExpandOverlay,
  ExpandTrigger,
  useExpandNudge,
} from "@/components/expanding-detail";
import { Input } from "@/components/ui/input";
import {
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemActions,
} from "@/components/ui/item";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export default function PaymentsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const { nudge, requestOpen, reset } = useExpandNudge();

  async function loadPlayers() {
    const d = await fetch("/api/players").then((r) => r.json());
    setPlayers(d.players ?? []);
    return (d.players ?? []) as Player[];
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlayers().then((list) => {
      // Deep link from the Sessions view: /payments?playerId=<id>
      const pid = Number(
        new URLSearchParams(window.location.search).get("playerId"),
      );
      if (Number.isInteger(pid)) {
        const p = list.find((x) => x.id === pid);
        if (p) setSelectedPlayer(p); // open directly, no nudge
      }
    });
  }, []);

  // Keep the player list fresh when data changes elsewhere.
  useDataRefresh(() => {
    loadPlayers();
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, search]);

  function back() {
    setSelectedPlayer(null);
    reset();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Payments" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search a player"
        autoFocus
      />
      {filtered.length === 0 ? (
        <Empty className="border rounded-xl py-10">
          <EmptyHeader>
            <EmptyTitle>No players</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup>
          {filtered.map((p) => (
            <ExpandTrigger
              key={p.id}
              layoutId={`player-${p.id}`}
              nudge={nudge}
              onOpen={(y) =>
                requestOpen(`player-${p.id}`, y, () => setSelectedPlayer(p))
              }
            >
              <ItemContent>
                <ItemTitle>{p.name}</ItemTitle>
              </ItemContent>
              <ItemActions>
                <ChevronRight className="size-4 text-muted-foreground" />
              </ItemActions>
            </ExpandTrigger>
          ))}
        </ItemGroup>
      )}

      <ExpandOverlay
        open={!!selectedPlayer}
        layoutId={`player-${selectedPlayer?.id}`}
      >
        {selectedPlayer && (
          <PlayerDetail
            player={{ id: selectedPlayer.id, name: selectedPlayer.name }}
            onBack={back}
          />
        )}
      </ExpandOverlay>
    </div>
  );
}
