"use client";

import { useState } from "react";
import { mutate } from "swr";
import { useTrackedSWR } from "@/lib/use-tracked-swr";
import { useScrollRestoration } from "@/lib/use-scroll-restoration";
import { ShoppingBasket, Filter, Search } from "lucide-react";
import { formatCents } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { PlayerDetail } from "@/components/player-detail";
import {
  ExpandOverlay,
  ExpandTrigger,
  useExpandNudge,
} from "@/components/expanding-detail";
import { ListCard, ListRow, ListRowAvatar } from "@/components/list-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { CenteredSpinner } from "@/components/ui/spinner";
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

const OVERVIEW_KEY = "/api/overview";

export default function OverviewPage() {
  useScrollRestoration();
  const { data, error, isLoading } = useTrackedSWR<Overview>(OVERVIEW_KEY);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const { nudge, requestOpen, reset } = useExpandNudge();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<
    "name-asc" | "name-desc" | "owed-desc" | "owed-asc"
  >("name-asc");

  function back() {
    setSelectedPlayer(null);
    reset();
    mutate(OVERVIEW_KEY); // refresh balances after any mark-paid in the detail
  }

  const q = search.trim().toLowerCase();
  const allOwing = (data?.playerBalances ?? []).filter((p) => p.owed > 0);
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

        {isLoading ? (
          <CenteredSpinner />
        ) : !data || error ? (
          <Empty className="border rounded-xl py-10">
            <EmptyHeader>
              <EmptyTitle>Could not load overview</EmptyTitle>
              <EmptyDescription>
                Check your connection and retry.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="relative">

              <div
                aria-hidden
                className="absolute inset-x-6 -top-10 z-0 h-32 rounded-full blur-lg"
                style={{
                  background:
                    "radial-gradient(circle, #b7d7f5 0%, transparent 100%)",
                }}
              />
              <div className="relative z-10 isolate rounded-3xl p-5 text-white shadow-lg border-2 border-[#f3f3fb]/20">
              <div
                className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
                style={{
                  // Layered radial "mesh gradient" sampled from the reference: a
                  // blue glow left-of-center bleeding into a paler blue-lavender
                  // on the right, over a purple base that shows through at the
                  // corners (lighter top-right, deeper bottom-right).
                  backgroundImage: `
              radial-gradient(circle at 40% 58%, #6a98f5 0%, transparent 50%),
              radial-gradient(circle at 60% 20%, #99b7f5 0%, transparent 100%),
              radial-gradient(ellipse 70% 55% at 100% 0%, #dae2f6 0%, transparent 100%),
              radial-gradient(ellipse 70% 55% at 100% 100%, #bab8f6 0%, transparent 60%),
              radial-gradient(circle at 100% 0%, #b5b7f7 0%, transparent 45%),
              radial-gradient(circle at 100% 100%, #9398f4 0%, transparent 55%)
            `,
                  backgroundColor: "#9398f7",
                }}
              />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5 text-xl font-medium text-white/90">
                  Outstanding
                </div>
              </div>
              <div className="mt-3 text-5xl tracking-tight">
                {formatCents(data.totalOutstanding)}
              </div>
              <div className="mt-3 flex items-center gap-1">
                <ShoppingBasket className="size-4 text-emerald-300" />
                <span className="text-emerald-300">
                  {formatCents(data.totalCollected)}
                </span>
                <span className="text-white/80">collected</span>
              </div>
              </div>
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
                <ListCard>
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
                      surfaceClassName="border-transparent bg-card"
                      className="rounded-none p-0"
                    >
                      <ListRow
                        icon={<ListRowAvatar name={p.name} colorKey={String(p.playerId)} />}
                        title={p.name}
                        subtitle={`${p.unpaid} unpaid ${p.unpaid === 1 ? "session" : "sessions"}`}
                        trailing={
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {formatCents(p.owed)}
                          </span>
                        }
                        chevron
                        className="w-full"
                      />
                    </ExpandTrigger>
                  ))}
                </ListCard>
              )}
            </section>
          </>
        )}
      </div>

      <ExpandOverlay
        open={!!selectedPlayer}
        layoutId={`player-${selectedPlayer?.id}`}
        onDismiss={back}
      >
        {selectedPlayer && (
          <PlayerDetail player={selectedPlayer} onBack={back} />
        )}
      </ExpandOverlay>
    </>
  );
}
