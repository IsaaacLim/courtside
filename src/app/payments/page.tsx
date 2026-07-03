"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import type { Player } from "@/db/schema";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useDataRefresh } from "@/hooks/use-data-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

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
      .then((d) => {
        const list: Player[] = d.players ?? [];
        setPlayers(list);
        // Deep link from the Sessions view: /payments?playerId=<id>
        const pid = Number(
          new URLSearchParams(window.location.search).get("playerId"),
        );
        if (Number.isInteger(pid)) {
          const p = list.find((x) => x.id === pid);
          if (p) openPlayer(p);
        }
      });
  }, []);

  // Refetch quietly when a session is created from the global drawer: refresh
  // the player list and, if one is open, its attendance rows.
  useDataRefresh(async () => {
    const d = await fetch("/api/players").then((r) => r.json());
    setPlayers(d.players ?? []);
    if (selectedPlayer) {
      const data = await fetch(
        `/api/attendances?playerId=${selectedPlayer.id}`,
      ).then((r) => r.json());
      setRows(data.attendances ?? []);
    }
  });

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
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Payments</h1>
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
              <Item key={p.id} asChild variant="outline">
                <button type="button" onClick={() => openPlayer(p)}>
                  <ItemContent>
                    <ItemTitle>{p.name}</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </ItemActions>
                </button>
              </Item>
            ))}
          </ItemGroup>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSelectedPlayer(null)}
        className="-ml-2 text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        All players
      </Button>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{selectedPlayer.name}</h1>
        <Badge
          variant={outstanding > 0 ? "destructive" : "secondary"}
          className="text-sm"
        >
          {formatCents(outstanding)} due
        </Badge>
      </div>

      {loadingRows ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Unpaid
              </h2>
              <Badge variant="secondary">{unpaid.length}</Badge>
            </div>
            {unpaid.length === 0 ? (
              <Empty className="border rounded-xl py-8">
                <EmptyHeader>
                  <EmptyTitle>All settled 🎉</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup>
                {unpaid.map((r) => {
                  const sel = checked.has(r.id);
                  return (
                    <Item
                      key={r.id}
                      variant="outline"
                      role="button"
                      aria-pressed={sel}
                      onClick={() => toggleCheck(r.id)}
                      className={cn(
                        "cursor-pointer select-none",
                        sel && "border-primary ring-1 ring-primary/30",
                      )}
                    >
                      <Checkbox
                        checked={sel}
                        className="size-5 pointer-events-none"
                        tabIndex={-1}
                        aria-hidden
                      />
                      <ItemContent>
                        <ItemTitle>
                          <Link
                            href={`/sessions?sessionId=${r.sessionId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                          >
                            {fmtDate(r.date)}
                            <ArrowUpRight
                              className="size-3.5 text-muted-foreground/50"
                              aria-hidden
                            />
                          </Link>
                        </ItemTitle>
                        <ItemDescription>
                          {formatCents(r.amountDue)}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaid([r.id], true);
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Paid
                        </Button>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            )}
          </section>

          {checked.size > 0 && (
            <Button
              onClick={() => setPaid([...checked], true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white h-11 text-base"
            >
              Mark {checked.size} paid · {formatCents(checkedTotal)}
            </Button>
          )}

          {paid.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Paid
                </h2>
                <Badge variant="secondary">{paid.length}</Badge>
              </div>
              <ItemGroup>
                {paid.map((r) => (
                  <Item key={r.id} variant="muted">
                    <ItemContent>
                      <ItemTitle className="text-muted-foreground">
                        <Link
                          href={`/sessions?sessionId=${r.sessionId}`}
                          className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                        >
                          {fmtDate(r.date)}
                          <ArrowUpRight
                            className="size-3.5 text-muted-foreground/50"
                            aria-hidden
                          />
                        </Link>
                      </ItemTitle>
                      <ItemDescription>
                        {formatCents(r.amountDue)}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPaid([r.id], false)}
                        className="text-muted-foreground"
                      >
                        Undo
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </section>
          )}
        </>
      )}
    </div>
  );
}
