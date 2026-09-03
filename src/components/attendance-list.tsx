import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListCard, ListRow, ListRowCheckbox } from "@/components/list-card";

type AttendanceLike = { id: number; amountDue: number };

/**
 * "Unpaid"/"Paid" section heading with the count badge and an optional
 * "Select all" / "Deselect all" toggle — shared between the Sessions and
 * Player detail views, which both list attendance rows this way.
 */
export function AttendanceSectionHeader({
  label,
  count,
  allSelected,
  onToggleSelectAll,
}: {
  label: string;
  count: number;
  allSelected?: boolean;
  onToggleSelectAll?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{label}</h2>
        <Badge variant="secondary">{count}</Badge>
      </div>
      {onToggleSelectAll && count > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSelectAll}
          className="-mr-2 text-muted-foreground"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
      )}
    </div>
  );
}

/**
 * Selectable list of unpaid attendance rows: circular checkbox, a
 * caller-rendered title (the counterparty — player or session — differs
 * per page), amount due, and a per-row "Paid" action.
 */
export function UnpaidAttendanceList<T extends AttendanceLike>({
  rows,
  checked,
  onToggle,
  onMarkPaid,
  renderTitle,
}: {
  rows: T[];
  checked: Set<number>;
  onToggle: (id: number) => void;
  onMarkPaid: (id: number) => void;
  renderTitle: (row: T) => ReactNode;
}) {
  return (
    <ListCard>
      {rows.map((r) => {
        const sel = checked.has(r.id);
        return (
          <div
            key={r.id}
            role="button"
            aria-pressed={sel}
            onClick={() => onToggle(r.id)}
            className={cn("cursor-pointer select-none", sel && "bg-primary/5")}
          >
            <ListRow
              icon={<ListRowCheckbox checked={sel} />}
              title={renderTitle(r)}
              subtitle={formatCents(r.amountDue)}
              trailing={
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkPaid(r.id);
                  }}
                  className="rounded-2xl bg-green-600 hover:bg-green-700 text-white"
                >
                  Paid
                </Button>
              }
              className="w-full"
            />
          </div>
        );
      })}
    </ListCard>
  );
}

/**
 * Settled counterpart to UnpaidAttendanceList: muted checkbox, dimmed
 * title, and an "Undo" action instead of a selection/"Paid" flow.
 */
export function PaidAttendanceList<T extends AttendanceLike>({
  rows,
  onUndo,
  renderTitle,
}: {
  rows: T[];
  onUndo: (id: number) => void;
  renderTitle: (row: T) => ReactNode;
}) {
  return (
    <ListCard>
      {rows.map((r) => (
        <ListRow
          key={r.id}
          icon={<ListRowCheckbox checked muted />}
          title={<span className="text-muted-foreground">{renderTitle(r)}</span>}
          subtitle={formatCents(r.amountDue)}
          trailing={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUndo(r.id)}
              className="text-muted-foreground"
            >
              Undo
            </Button>
          }
          className="w-full"
        />
      ))}
    </ListCard>
  );
}

/**
 * Non-interactive counterpart to Unpaid/PaidAttendanceList: same row look
 * (checkbox reflecting paid state, dimmed once paid) but no click target, no
 * per-row action — used by the read-only preview modals.
 */
export function ReadOnlyAttendanceList<T extends AttendanceLike & { paid: boolean }>({
  rows,
  renderTitle,
}: {
  rows: T[];
  renderTitle: (row: T) => ReactNode;
}) {
  return (
    <ListCard>
      {rows.map((r) => (
        <ListRow
          key={r.id}
          icon={<ListRowCheckbox checked={r.paid} muted={r.paid} />}
          title={
            r.paid ? (
              <span className="text-muted-foreground">{renderTitle(r)}</span>
            ) : (
              renderTitle(r)
            )
          }
          subtitle={formatCents(r.amountDue)}
          className="w-full"
        />
      ))}
    </ListCard>
  );
}

/**
 * Fixed bottom "Mark N paid" bar, floating above the mobile home bar.
 * Renders nothing when there's no active selection.
 */
export function MarkPaidFloatingButton({
  count,
  total,
  onClick,
}: {
  count: number;
  total: number;
  onClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="mx-auto max-w-2xl">
        <Button
          onClick={onClick}
          className="pointer-events-auto w-full rounded-2xl bg-green-600 hover:bg-green-700 text-white h-11 text-base shadow-lg shadow-green-600/30"
        >
          Mark {count} paid · {formatCents(total)}
        </Button>
      </div>
    </div>
  );
}
