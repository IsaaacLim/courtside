"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, EllipsisVertical, Pencil } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";
import { useTrackedSWR } from "@/lib/use-tracked-swr";
import { useAttendanceMutations } from "@/lib/use-attendance-mutations";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ExpandBackBar } from "@/components/expanding-detail";
import { SessionPreview } from "@/components/session-preview";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  AttendanceSectionHeader,
  MarkPaidFloatingButton,
  PaidAttendanceList,
  UnpaidAttendanceList,
} from "@/components/attendance-list";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

type AttendanceRow = {
  id: number;
  sessionId: number;
  date: string;
  amountDue: number;
  paid: boolean;
  paidAt: string | null;
  method: string | null;
};

/**
 * A player's payment detail: unpaid/paid sessions with mark-paid actions.
 * Rendered inside an ExpandOverlay on the Overview page.
 */
export function PlayerDetail({
  player,
  onBack,
}: {
  player: { id: number; name: string };
  onBack: () => void;
}) {
  const key = `/api/attendances?playerId=${player.id}`;
  const { data, isLoading: loadingRows } = useTrackedSWR<{
    attendances: AttendanceRow[];
  }>(key);
  const rows = data?.attendances ?? [];
  const { checked, setChecked, toggleCheck, setPaid } = useAttendanceMutations(
    key,
    rows,
    (r) => `/api/attendances?sessionId=${r.sessionId}`,
  );
  const [displayName, setDisplayName] = useState(player.name);
  const [editOpen, setEditOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const [previewSession, setPreviewSession] = useState<{
    id: number;
    date: string;
  } | null>(null);

  async function saveRename() {
    const name = nameInput.trim();
    if (!name || name === displayName) {
      setEditOpen(false);
      return;
    }
    const res = await fetch(`/api/players/${player.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setDisplayName(name);
      setEditOpen(false);
      // Broadcast: refresh player lists and any open session's attendance
      // rows elsewhere without waiting for a navigation.
      mutate(() => true);
      toast.success(`Name changed to ${name}`);
    } else {
      toast.error("Could not change name");
    }
  }

  const unpaid = rows.filter((r) => !r.paid);
  const paid = rows.filter((r) => r.paid);
  const allSelected = unpaid.length > 0 && unpaid.every((r) => checked.has(r.id));
  const outstanding = unpaid.reduce((sum, r) => sum + r.amountDue, 0);
  // Earliest / latest due dates among the unpaid sessions (ISO strings sort
  // chronologically).
  const dueDates = unpaid.map((r) => r.date).sort();
  const earliestDue = dueDates[0];
  const latestDue = dueDates[dueDates.length - 1];
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
                aria-label="Player actions"
                className="px-0"
              >
                <EllipsisVertical className="size-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setNameInput(displayName);
                  setEditOpen(true);
                }}
              >
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <h1 className="text-2xl font-bold">{displayName}</h1>

      <Card>
        <CardHeader>
          <CardDescription>Outstanding</CardDescription>
          <CardTitle
            className={cn(
              "text-4xl font-bold tabular-nums",
              outstanding > 0
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground",
            )}
          >
            {formatCents(outstanding)}
          </CardTitle>
        </CardHeader>
        {unpaid.length > 0 && (
          <CardContent className="flex items-center justify-between text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Earliest due</div>
              <div className="font-medium">{formatDate(earliestDue)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Latest due</div>
              <div className="font-medium">{formatDate(latestDue)}</div>
            </div>
          </CardContent>
        )}
      </Card>

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
                  <EmptyTitle>All settled 🎉</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <UnpaidAttendanceList
                rows={unpaid}
                checked={checked}
                onToggle={toggleCheck}
                onMarkPaid={(id) => setPaid([id], true)}
                renderTitle={(r) => (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewSession({ id: r.sessionId, date: r.date });
                    }}
                    className="inline-flex items-center gap-1"
                  >
                    {formatDate(r.date)}
                    <ArrowUpRight
                      className="size-3.5 text-muted-foreground/50"
                      aria-hidden
                    />
                  </button>
                )}
              />
            )}
          </section>

          {paid.length > 0 && (
            <section className="space-y-2">
              <AttendanceSectionHeader label="Paid" count={paid.length} />
              <PaidAttendanceList
                rows={paid}
                onUndo={(id) => setPaid([id], false)}
                renderTitle={(r) => (
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewSession({ id: r.sessionId, date: r.date })
                    }
                    className="inline-flex items-center gap-1"
                  >
                    {formatDate(r.date)}
                    <ArrowUpRight
                      className="size-3.5 text-muted-foreground/50"
                      aria-hidden
                    />
                  </button>
                )}
              />
            </section>
          )}

          {/* Spacer so the last rows can scroll clear of the floating bar. */}
          {checked.size > 0 && <div className="h-16" aria-hidden />}
        </>
      )}

      {/* Rename dialog — the input auto-focuses so the keyboard opens. */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => {
            // Focus the input (not the default close button) to raise the keyboard.
            e.preventDefault();
            nameRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit name</DialogTitle>
          </DialogHeader>
          <Input
            ref={nameRef}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
            }}
            placeholder="Player name"
          />
          <DialogFooter>
            <Button onClick={saveRename} disabled={!nameInput.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MarkPaidFloatingButton
        count={checked.size}
        total={checkedTotal}
        onClick={() => setPaid([...checked], true)}
      />

      <SessionPreview
        session={previewSession}
        onOpenChange={(open) => !open && setPreviewSession(null)}
      />
    </>
  );
}
