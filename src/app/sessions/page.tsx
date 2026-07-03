"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  EllipsisVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useDataRefresh, notifyDataChanged } from "@/hooks/use-data-refresh";
import { PageHeader } from "@/components/page-header";
import { NewSessionForm } from "@/components/new-session-form";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// ISO timestamp -> "YYYY-MM-DD" in local time, for the edit form's date input.
function toDateInput(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
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
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function loadSessions(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetch("/api/sessions");
    const data = await res.json();
    const list: SessionSummary[] = data.sessions ?? [];
    setSessions(list);
    setLoading(false);
    return list;
  }

  // Refetch quietly when a session is created from the global drawer.
  useDataRefresh(() => {
    loadSessions(true);
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions().then((list) => {
      // Deep link from the Payments view: /sessions?sessionId=<id>
      const sid = Number(
        new URLSearchParams(window.location.search).get("sessionId"),
      );
      if (Number.isInteger(sid)) {
        const s = list.find((x) => x.id === sid);
        if (s) openSession(s);
      }
    });
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

  // After a successful edit: close the drawer and refetch the updated session.
  async function afterEdit() {
    setEditOpen(false);
    const id = selected?.id;
    const list = await loadSessions(true);
    const updated = list.find((s) => s.id === id);
    if (updated) openSession(updated); // re-pulls the summary + attendance rows
    toast.success("Session updated");
  }

  async function deleteSession() {
    if (!selected) return;
    const label = fmtDate(selected.date);
    const res = await fetch(`/api/sessions/${selected.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      notifyDataChanged();
      back(); // returns to the list and refetches
      toast.success(`Session on ${label} removed`);
    } else {
      toast.error("Could not delete session");
    }
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
        <PageHeader title="Sessions" />

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
      {/* Back on the left; secondary actions in an overflow menu on the right. */}
      <div className="fixed inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 pt-3 pb-2">
          <Button variant="ghost" size="sm" onClick={back} className="px-0">
            <ArrowLeft className="size-6" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Session actions"
                className="px-0"
              >
                <EllipsisVertical className="size-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setConfirmOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Edit drawer, opened from the overflow menu. */}
      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <DrawerContent className="h-[85vh]">
          <DrawerHeader className="text-left shrink-0">
            <DrawerTitle>Edit session</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 px-4 pb-8">
            <NewSessionForm
              fill
              session={{
                id: selected.id,
                date: toDateInput(selected.date),
                rate: selected.rate,
                playerIds: rows.map((r) => r.playerId),
              }}
              onSuccess={afterEdit}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete confirmation, opened from the overflow menu. */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this session?</DialogTitle>
            <DialogDescription>
              This permanently removes the session on {fmtDate(selected.date)}{" "}
              and its {rows.length}{" "}
              {rows.length === 1 ? "attendance" : "attendances"}. This
              can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={deleteSession}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extra top padding clears the fixed back bar above. */}
      <PageHeader
        title={fmtDate(selected.date)}
        className="pt-8"
        actions={
          <Badge
            variant={outstanding > 0 ? "destructive" : "secondary"}
            className="text-sm"
          >
            {formatCents(outstanding)} due
          </Badge>
        }
      />

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
                            href={`/payments?playerId=${r.playerId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                          >
                            {r.playerName}
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
                          href={`/payments?playerId=${r.playerId}`}
                          className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                        >
                          {r.playerName}
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
