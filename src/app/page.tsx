"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Filter, Search } from "lucide-react";
import { formatCents } from "@/lib/money";
import { useDataRefresh } from "@/hooks/use-data-refresh";
import { PageHeader } from "@/components/page-header";
import { PlayerDetail } from "@/components/player-detail";
import {
  ExpandOverlay,
  ExpandTrigger,
  useExpandNudge,
} from "@/components/expanding-detail";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

type Overview = {
  totalOutstanding: number;
  totalCollected: number;
  playerBalances: {
    playerId: number;
    name: string;
    owed: number;
    unpaid: number;
    sessions: number;
  }[];
  sessions: {
    sessionId: number;
    date: string;
    rate: number;
    total: number;
    paid: number;
  }[];
};

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const { nudge, requestOpen, reset } = useExpandNudge();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<
    "name-asc" | "name-desc" | "owed-desc" | "owed-asc"
  >("name-asc");

  async function load() {
    const d: Overview = await fetch("/api/overview").then((r) => r.json());
    setData(d);
    setLoading(false);
    return d;
  }

  function back() {
    setSelectedPlayer(null);
    reset();
    load(); // refresh balances after any mark-paid in the detail
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().then((d) => {
      // Deep link (e.g. from a session's player link): /?playerId=<id>
      const pid = Number(
        new URLSearchParams(window.location.search).get("playerId"),
      );
      if (Number.isInteger(pid)) {
        const p = d.playerBalances.find((x) => x.playerId === pid);
        if (p) setSelectedPlayer({ id: p.playerId, name: p.name });
      }
    });
  }, []);

  useDataRefresh(load);

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-6" />
      </div>
    );
  if (!data)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Could not load overview</EmptyTitle>
          <EmptyDescription>Check your connection and retry.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const q = search.trim().toLowerCase();
  const allOwing = data.playerBalances.filter((p) => p.owed > 0);
  const owing = allOwing
    .filter((p) => p.name.toLowerCase().includes(q))
    .sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "owed-asc":
          return a.owed - b.owed || a.name.localeCompare(b.name);
        default: // owed-desc
          return b.owed - a.owed || a.name.localeCompare(b.name);
      }
    });

  return (
    <>
      <div className="space-y-6">
        <PageHeader title="Overview" />

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardDescription>Outstanding</CardDescription>
            <CardTitle className="text-2xl text-red-600 dark:text-red-400">
              {formatCents(data.totalOutstanding)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Collected</CardDescription>
            <CardTitle className="text-2xl text-green-600 dark:text-green-400">
              {formatCents(data.totalCollected)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Who owes
          </h2>
          <Badge variant="secondary">{allOwing.length}</Badge>
        </div>

        {allOwing.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search players"
                className="pl-8"
              />
            </div>
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as typeof sort)}
            >
              <SelectTrigger
                aria-label="Sort players"
                className="h-9 gap-0 px-2.5 [&>svg:last-child]:hidden"
              >
                <Filter className="size-4" />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                <SelectItem value="name-asc">Name A–Z</SelectItem>
                <SelectItem value="name-desc">Name Z–A</SelectItem>
                <SelectItem value="owed-desc">Most owed</SelectItem>
                <SelectItem value="owed-asc">Least owed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {allOwing.length === 0 ? (
          <Empty className="border rounded-xl py-8">
            <EmptyHeader>
              <EmptyTitle>Everyone&rsquo;s settled 🎉</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : owing.length === 0 ? (
          <Empty className="border rounded-xl py-8">
            <EmptyHeader>
              <EmptyTitle>No players match</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup>
            {owing.map((p) => (
              <ExpandTrigger
                key={p.playerId}
                layoutId={`player-${p.playerId}`}
                nudge={nudge}
                onOpen={(y) =>
                  requestOpen(`player-${p.playerId}`, y, () =>
                    setSelectedPlayer({ id: p.playerId, name: p.name }),
                  )
                }
              >
                <ItemContent>
                  <ItemTitle>{p.name}</ItemTitle>
                  <ItemDescription>
                    {p.unpaid} unpaid {p.unpaid === 1 ? "session" : "sessions"}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {formatCents(p.owed)}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </ItemActions>
              </ExpandTrigger>
            ))}
          </ItemGroup>
        )}
      </section>
      </div>

      <ExpandOverlay
        open={!!selectedPlayer}
        layoutId={`player-${selectedPlayer?.id}`}
      >
        {selectedPlayer && (
          <PlayerDetail player={selectedPlayer} onBack={back} />
        )}
      </ExpandOverlay>
    </>
  );
}
