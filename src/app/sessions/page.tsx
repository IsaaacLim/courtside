"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  EllipsisVertical,
  Pencil,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { NewSessionForm } from "@/components/new-session-form";
import {
  ExpandBackBar,
  ExpandOverlay,
  ExpandTrigger,
  useExpandNudge,
} from "@/components/expanding-detail";
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
  playerActive: boolean;
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
  nudge,
  onOpen,
}: {
  sessions: SessionSummary[];
  nudge: { id: string | number | null; y: number };
  onOpen: (s: SessionSummary, y: number) => void;
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
        <ExpandTrigger
          key={s.id}
          layoutId={`session-${s.id}`}
          nudge={nudge}
          onOpen={(y) => onOpen(s, y)}
        >
          <ItemContent>
            <ItemTitle>{fmtDate(s.date)}</ItemTitle>
            <ItemDescription className="flex items-center gap-1">
              {formatCents(s.rate)} · {s.total}
              {s.total === 1 ? (
                <User className="size-3.5" />
              ) : (
                <Users className="size-3.5" />
              )}
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
        </ExpandTrigger>
      ))}
    </ItemGroup>
  );
}

const SESSIONS_KEY = "/api/sessions";

export default function SessionsPage() {
  const { data: sessionsData, isLoading: loading } = useSWR<{
    sessions: SessionSummary[];
  }>(SESSIONS_KEY);
  const sessions = sessionsData?.sessions ?? [];
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const attendancesKey = selected
    ? `/api/attendances?sessionId=${selected.id}`
    : null;
  const { data: rowsData, isLoading: loadingRows } = useSWR<{
    attendances: SessionAttendance[];
  }>(attendancesKey);
  const rows = rowsData?.attendances ?? [];
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { nudge, requestOpen, reset } = useExpandNudge();

  function openSession(s: SessionSummary) {
    setSelected(s);
    setChecked(new Set());
  }

  // Deep link from a player's session link: /sessions?sessionId=<id>. Only
  // acted on once, so re-opening the page doesn't keep re-triggering it.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (!sessionsData || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    const sid = Number(
      new URLSearchParams(window.location.search).get("sessionId"),
    );
    if (Number.isInteger(sid)) {
      const s = sessionsData.sessions.find((x) => x.id === sid);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s) openSession(s);
    }
  }, [sessionsData]);

  // Nudge the tapped row's label toward the header, then expand the panel.
  function openTrigger(s: SessionSummary, y: number) {
    requestOpen(`session-${s.id}`, y, () => openSession(s));
  }

  function back() {
    setSelected(null);
    reset(); // let the row's label ease back in
    // Refresh unpaid counts in case anything changed while in the detail.
    mutate(SESSIONS_KEY);
  }

  // After a successful edit: close the drawer and refetch the updated session.
  async function afterEdit() {
    setEditOpen(false);
    const id = selected?.id;
    const result = await mutate<{ sessions: SessionSummary[] }>(
      SESSIONS_KEY,
    );
    const updated = result?.sessions.find((s) => s.id === id);
    if (updated) setSelected(updated);
    if (id) mutate(`/api/attendances?sessionId=${id}`);
    toast.success("Session updated");
  }

  async function deleteSession() {
    if (!selected) return;
    const label = fmtDate(selected.date);
    const res = await fetch(`/api/sessions/${selected.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      mutate("/api/overview");
      back(); // returns to the list and refetches
      toast.success(`Session on ${label} removed`);
    } else {
      toast.error("Could not delete session");
    }
  }

  async function setPaid(ids: number[], paid: boolean) {
    const affectedPlayerIds = new Set(
      rows.filter((r) => ids.includes(r.id)).map((r) => r.playerId),
    );
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/attendances/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paid }),
        }),
      ),
    );
    mutate(
      attendancesKey,
      (curr: { attendances: SessionAttendance[] } | undefined) =>
        curr && {
          attendances: curr.attendances.map((r) =>
            ids.includes(r.id)
              ? { ...r, paid, paidAt: paid ? new Date().toISOString() : null }
              : r,
          ),
        },
      { revalidate: false },
    );
    setChecked(new Set());
    // Instant same-tab refresh of Overview/Players balances and the list's
    // unpaid badge — this is also what makes mark-paid-from-Sessions
    // consistent with mark-paid-from-player-detail (previously it wasn't).
    mutate("/api/overview");
    mutate(SESSIONS_KEY);
    for (const pid of affectedPlayerIds) {
      mutate(`/api/attendances?playerId=${pid}`);
    }
  }

  function toggleCheck(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const active = sessions.filter((s) => s.unpaid > 0);
  const archived = sessions.filter((s) => s.unpaid === 0);

  // Detail-derived values (harmless in list mode: rows/checked are empty).
  const unpaid = rows.filter((r) => !r.paid);
  const paid = rows.filter((r) => r.paid);
  const outstanding = unpaid.reduce((sum, r) => sum + r.amountDue, 0);
  const checkedTotal = unpaid
    .filter((r) => checked.has(r.id))
    .reduce((sum, r) => sum + r.amountDue, 0);

  return (
    <>
      {/* The list stays mounted so its scroll is preserved and the shared
          surface keeps a stable anchor to morph from/to. */}
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
              <SessionList sessions={active} nudge={nudge} onOpen={openTrigger} />
            </TabsContent>
            <TabsContent value="archive" className="mt-3">
              <SessionList
                sessions={archived}
                nudge={nudge}
                onOpen={openTrigger}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <ExpandOverlay open={!!selected} layoutId={`session-${selected?.id}`}>
        {selected && (
          <>
            <ExpandBackBar
              onBack={back}
              actions={
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
              }
            />

            {/* Header: session date + amount due. */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xl font-bold">
                {fmtDate(selected.date)}
              </span>
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
                              "cursor-pointer select-none bg-raised",
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
                                {r.playerActive ? (
                                  <Link
                                    href={`/?playerId=${r.playerId}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                                  >
                                    {r.playerName}
                                    <ArrowUpRight
                                      className="size-3.5 text-muted-foreground/50"
                                      aria-hidden
                                    />
                                  </Link>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5">
                                    {r.playerName}
                                    <Badge variant="secondary" className="text-[10px]">
                                      Inactive
                                    </Badge>
                                  </span>
                                )}
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
                        <Item key={r.id} variant="muted" className="bg-raised">
                          <ItemContent>
                            <ItemTitle className="text-muted-foreground">
                              {r.playerActive ? (
                                <Link
                                  href={`/?playerId=${r.playerId}`}
                                  className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                                >
                                  {r.playerName}
                                  <ArrowUpRight
                                    className="size-3.5 text-muted-foreground/50"
                                    aria-hidden
                                  />
                                </Link>
                              ) : (
                                <span className="inline-flex items-center gap-1.5">
                                  {r.playerName}
                                  <Badge variant="secondary" className="text-[10px]">
                                    Inactive
                                  </Badge>
                                </span>
                              )}
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
          </>
        )}
      </ExpandOverlay>

      {/* Edit drawer + delete dialog (portaled to body). */}
      {selected && (
        <>
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

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this session?</DialogTitle>
                <DialogDescription>
                  This permanently removes the session on{" "}
                  {fmtDate(selected.date)} and its {rows.length}{" "}
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
        </>
      )}
    </>
  );
}
