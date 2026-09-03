"use client";

import { useTrackedSWR } from "@/lib/use-tracked-swr";
import { useBackDismiss } from "@/lib/use-back-dismiss";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  AttendanceSectionHeader,
  ReadOnlyAttendanceList,
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
 * Read-only bottom-sheet preview of a player's attendance, opened from
 * inside the Session detail view when a player is tapped there. View +
 * close only — no edit, select-all, or mark-paid/undo.
 */
export function PlayerPreview({
  player,
  onOpenChange,
}: {
  player: { id: number; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  useBackDismiss(!!player, () => onOpenChange(false));

  const key = player ? `/api/attendances?playerId=${player.id}` : null;
  const { data, isLoading } = useTrackedSWR<{ attendances: AttendanceRow[] }>(
    key,
  );
  const rows = data?.attendances ?? [];
  const unpaid = rows.filter((r) => !r.paid);
  const paid = rows.filter((r) => r.paid);
  const outstanding = unpaid.reduce((sum, r) => sum + r.amountDue, 0);
  const dueDates = unpaid.map((r) => r.date).sort();
  const earliestDue = dueDates[0];
  const latestDue = dueDates[dueDates.length - 1];

  return (
    <Drawer open={!!player} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh]">
        <DrawerHeader className="text-left shrink-0">
          <DrawerTitle className="text-base">{player?.name ?? ""}</DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-8">
          {isLoading ? (
            <CenteredSpinner />
          ) : (
            <>
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
                      <div className="text-xs text-muted-foreground">
                        Earliest due
                      </div>
                      <div className="font-medium">{formatDate(earliestDue)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        Latest due
                      </div>
                      <div className="font-medium">{formatDate(latestDue)}</div>
                    </div>
                  </CardContent>
                )}
              </Card>

              <section className="space-y-2">
                <AttendanceSectionHeader label="Unpaid" count={unpaid.length} />
                {unpaid.length === 0 ? (
                  <Empty className="border rounded-xl py-8">
                    <EmptyHeader>
                      <EmptyTitle>All settled 🎉</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ReadOnlyAttendanceList
                    rows={unpaid}
                    renderTitle={(r) => formatDate(r.date)}
                  />
                )}
              </section>

              {paid.length > 0 && (
                <section className="space-y-2">
                  <AttendanceSectionHeader label="Paid" count={paid.length} />
                  <ReadOnlyAttendanceList
                    rows={paid}
                    renderTitle={(r) => formatDate(r.date)}
                  />
                </section>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
