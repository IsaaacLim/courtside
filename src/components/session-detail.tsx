"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";
import { useTrackedSWR } from "@/lib/use-tracked-swr";
import { useAttendanceMutations } from "@/lib/use-attendance-mutations";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { ExpandBackBar } from "@/components/expanding-detail";
import { NewSessionForm } from "@/components/new-session-form";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  AttendanceSectionHeader,
  MarkPaidFloatingButton,
  PaidAttendanceList,
  UnpaidAttendanceList,
} from "@/components/attendance-list";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export type SessionSummary = {
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

const SESSIONS_KEY = "/api/sessions";

// ISO timestamp -> "YYYY-MM-DD" in local time, for the edit form's date input.
function toDateInput(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * A session's payment detail: unpaid/paid players with mark-paid actions.
 * Rendered inside an ExpandOverlay on the Sessions page.
 */
export function SessionDetail({
  session: initialSession,
  onBack,
}: {
  session: SessionSummary;
  onBack: () => void;
}) {
  const [session, setSession] = useState(initialSession);
  const key = `/api/attendances?sessionId=${session.id}`;
  const { data, isLoading: loadingRows } = useTrackedSWR<{
    attendances: SessionAttendance[];
  }>(key);
  const rows = data?.attendances ?? [];
  const { checked, setChecked, toggleCheck, setPaid } = useAttendanceMutations(
    key,
    rows,
    (r) => `/api/attendances?playerId=${r.playerId}`,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // After a successful edit: close the drawer and refetch the updated session.
  async function afterEdit() {
    setEditOpen(false);
    const result = await mutate<{ sessions: SessionSummary[] }>(SESSIONS_KEY);
    const updated = result?.sessions.find((s) => s.id === session.id);
    if (updated) setSession(updated);
    mutate(key);
    toast.success("Session updated");
  }

  async function deleteSession() {
    const label = formatDate(session.date);
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      mutate("/api/overview");
      onBack(); // returns to the list and refetches
      toast.success(`Session on ${label} removed`);
    } else {
      toast.error("Could not delete session");
    }
  }

  const unpaid = rows.filter((r) => !r.paid);
  const paid = rows.filter((r) => r.paid);
  const allSelected = unpaid.length > 0 && unpaid.every((r) => checked.has(r.id));
  const outstanding = unpaid.reduce((sum, r) => sum + r.amountDue, 0);
  const checkedTotal = unpaid
    .filter((r) => checked.has(r.id))
    .reduce((sum, r) => sum + r.amountDue, 0);

  return (
    <>
      <ExpandBackBar
        onBack={onBack}
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
        <span className="text-2xl font-bold">{formatDate(session.date)}</span>
        <Badge
          variant={outstanding > 0 ? "destructive" : "secondary"}
          className="text-sm"
        >
          {formatCents(outstanding)} due
        </Badge>
      </div>

      {loadingRows ? (
        <CenteredSpinner />
      ) : (
        <>
          <section className="space-y-2">
            <AttendanceSectionHeader
              label="Unpaid"
              count={unpaid.length}
              allSelected={allSelected}
              onToggleSelectAll={() =>
                setChecked(
                  allSelected ? new Set() : new Set(unpaid.map((r) => r.id)),
                )
              }
            />
            {unpaid.length === 0 ? (
              <Empty className="border rounded-xl py-8">
                <EmptyHeader>
                  <EmptyTitle>Everyone&rsquo;s paid 🎉</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <UnpaidAttendanceList
                rows={unpaid}
                checked={checked}
                onToggle={toggleCheck}
                onMarkPaid={(id) => setPaid([id], true)}
                renderTitle={(r) =>
                  r.playerActive ? (
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
                  )
                }
              />
            )}
          </section>

          {paid.length > 0 && (
            <section className="space-y-2">
              <AttendanceSectionHeader label="Paid" count={paid.length} />
              <PaidAttendanceList
                rows={paid}
                onUndo={(id) => setPaid([id], false)}
                renderTitle={(r) =>
                  r.playerActive ? (
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
                  )
                }
              />
            </section>
          )}

          {/* Spacer so the last rows can scroll clear of the floating bar. */}
          {checked.size > 0 && <div className="h-16" aria-hidden />}
        </>
      )}

      {/* Edit drawer + delete dialog. */}
      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <DrawerContent className="h-[85vh]">
          <DrawerHeader className="text-left shrink-0">
            <DrawerTitle>Edit session</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 px-4 pb-8">
            <NewSessionForm
              fill
              session={{
                id: session.id,
                date: toDateInput(session.date),
                rate: session.rate,
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
              This permanently removes the session on {formatDate(session.date)}{" "}
              and its {rows.length} {rows.length === 1 ? "attendance" : "attendances"}
              . This can&rsquo;t be undone.
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

      <MarkPaidFloatingButton
        count={checked.size}
        total={checkedTotal}
        onClick={() => setPaid([...checked], true)}
      />
    </>
  );
}
