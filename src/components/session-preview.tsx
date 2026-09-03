"use client";

import { useTrackedSWR } from "@/lib/use-tracked-swr";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { CenteredSpinner } from "@/components/ui/spinner";
import {
  AttendanceSectionHeader,
  ReadOnlyAttendanceList,
} from "@/components/attendance-list";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

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

/**
 * Read-only bottom-sheet preview of a session's attendance, opened from
 * inside the Player detail view when a session is tapped there. View +
 * close only — no edit, delete, select-all, or mark-paid/undo.
 */
export function SessionPreview({
  session,
  onOpenChange,
}: {
  session: { id: number; date: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const key = session ? `/api/attendances?sessionId=${session.id}` : null;
  const { data, isLoading } = useTrackedSWR<{
    attendances: SessionAttendance[];
  }>(key);
  const rows = data?.attendances ?? [];
  const unpaid = rows.filter((r) => !r.paid);
  const paid = rows.filter((r) => r.paid);
  const outstanding = unpaid.reduce((sum, r) => sum + r.amountDue, 0);

  function renderTitle(r: SessionAttendance) {
    return r.playerActive ? (
      r.playerName
    ) : (
      <span className="inline-flex items-center gap-1.5">
        {r.playerName}
        <Badge variant="secondary" className="text-[10px]">
          Inactive
        </Badge>
      </span>
    );
  }

  return (
    <Drawer open={!!session} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh]">
        <DrawerHeader className="text-left shrink-0">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DrawerTitle className="text-base">
              {session ? formatDate(session.date) : ""}
            </DrawerTitle>
            {session && (
              <Badge variant={outstanding > 0 ? "destructive" : "secondary"}>
                {formatCents(outstanding)} due
              </Badge>
            )}
          </div>
        </DrawerHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-8">
          {isLoading ? (
            <CenteredSpinner />
          ) : (
            <>
              <section className="space-y-2">
                <AttendanceSectionHeader label="Unpaid" count={unpaid.length} />
                {unpaid.length === 0 ? (
                  <Empty className="border rounded-xl py-8">
                    <EmptyHeader>
                      <EmptyTitle>Everyone&rsquo;s paid 🎉</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ReadOnlyAttendanceList rows={unpaid} renderTitle={renderTitle} />
                )}
              </section>

              {paid.length > 0 && (
                <section className="space-y-2">
                  <AttendanceSectionHeader label="Paid" count={paid.length} />
                  <ReadOnlyAttendanceList rows={paid} renderTitle={renderTitle} />
                </section>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
