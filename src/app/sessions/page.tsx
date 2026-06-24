"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

type SessionSummary = {
  id: number;
  date: string;
  rate: number;
  total: number;
  paid: number;
  unpaid: number;
};

type SessionAttendance = {
  id: number;
  playerId: number;
  playerName: string;
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

function SessionList({
  sessions,
  onOpen,
}: {
  sessions: SessionSummary[];
  onOpen: (s: SessionSummary) => void;
}) {
  if (sessions.length === 0) {
    return (
      <Empty className="border rounded-xl py-10">
        <EmptyHeader>
          <EmptyTitle>Nothing here</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ItemGroup>
      {sessions.map((s) => (
        <Item key={s.id} asChild variant="outline">
          <button type="button" onClick={() => onOpen(s)}>
            <ItemContent>
              <ItemTitle>{fmtDate(s.date)}</ItemTitle>
              <ItemDescription>
                {formatCents(s.rate)} · {s.total}{" "}
                {s.total === 1 ? "player" : "players"}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              {s.unpaid > 0 ? (
                <Badge variant="destructive">{s.unpaid} unpaid</Badge>
              ) : (
                <Badge variant="secondary">Paid</Badge>
              )}
              <ChevronRight className="size-4 text-muted-foreground" />
            </ItemActions>
          </button>
        </Item>
      ))}
    </ItemGroup>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const [rows, setRows] = useState<SessionAttendance[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loadingRows, setLoadingRows] = useState(false);

  async function loadSessions() {
    setLoading(true);
    const res = await fetch("/api/sessions");
    const data = await res.json();
    setSessions(data.sessions ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions();
  }, []);

  async function openSession(s: SessionSummary) {
    setSelected(s);
    setChecked(new Set());
    setLoadingRows(true);
    const res = await fetch(`/api/attendances?sessionId=${s.id}`);
    const data = await res.json();
    setRows(data.attendances ?? []);
    setLoadingRows(false);
  }

  function back() {
    setSelected(null);
    // Refetch so a now-fully-paid session moves to Archive.
    loadSessions();
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
    setRows((prev) =>
      prev.map((r) =>
        ids.includes(r.id)
          ? { ...r, paid, paidAt: paid ? new Date().toISOString() : null }
          : r,
      ),
    );
    setChecked(new Set());
  }

  function toggleCheck(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- List mode ----
  if (!selected) {
    const active = sessions.filter((s) => s.unpaid > 0);
    const archived = sessions.filter((s) => s.unpaid === 0);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Sessions</h1>
          <Button asChild size="sm">
            <Link href="/sessions/new">
              <Plus className="size-4" />
              New session
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-6" />
          </div>
        ) : (
          <Tabs defaultValue="active">
            <TabsList className="w-full">
              <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
              <TabsTrigger value="archive">
                Archive ({archived.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-3">
              <SessionList sessions={active} onOpen={openSession} />
            </TabsContent>
            <TabsContent value="archive" className="mt-3">
              <SessionList sessions={archived} onOpen={openSession} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    );
  }

  // ---- Detail mode ----
  const unpaid = rows.filter((r) => !r.paid);
  const paid = rows.filter((r) => r.paid);
  const outstanding = unpaid.reduce((sum, r) => sum + r.amountDue, 0);
  const checkedTotal = unpaid
    .filter((r) => checked.has(r.id))
    .reduce((sum, r) => sum + r.amountDue, 0);

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={back}
        className="-ml-2 text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        All sessions
      </Button>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{fmtDate(selected.date)}</h1>
        <Badge variant={outstanding > 0 ? "destructive" : "secondary"} className="text-sm">
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
                  <EmptyTitle>Everyone&rsquo;s paid 🎉</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup>
                {unpaid.map((r) => (
                  <Item key={r.id} variant="outline">
                    <Checkbox
                      checked={checked.has(r.id)}
                      onCheckedChange={() => toggleCheck(r.id)}
                      className="size-5"
                    />
                    <ItemContent>
                      <ItemTitle>{r.playerName}</ItemTitle>
                      <ItemDescription>
                        {formatCents(r.amountDue)}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        onClick={() => setPaid([r.id], true)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Paid
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
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
                        {r.playerName}
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
