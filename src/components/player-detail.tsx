"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { notifyDataChanged, useDataRefresh } from "@/hooks/use-data-refresh";
import { ExpandBackBar } from "@/components/expanding-detail";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * A player's payment detail: unpaid/paid sessions with mark-paid actions.
 * Rendered inside an ExpandOverlay from Payments and Overview.
 */
export function PlayerDetail({
  player,
  onBack,
}: {
  player: { id: number; name: string };
  onBack: () => void;
}) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loadingRows, setLoadingRows] = useState(true);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingRows(true);
    setChecked(new Set());
    fetch(`/api/attendances?playerId=${player.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setRows(data.attendances ?? []);
        setLoadingRows(false);
      });
    return () => {
      active = false;
    };
  }, [player.id]);

  // Refetch quietly when data changes elsewhere (e.g. a session is created).
  useDataRefresh(() => {
    fetch(`/api/attendances?playerId=${player.id}`)
      .then((r) => r.json())
      .then((data) => setRows(data.attendances ?? []));
  });

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
    notifyDataChanged(); // refresh Overview / Sessions balances
  }

  function toggleCheck(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      <ExpandBackBar onBack={onBack} />

      <h1 className="text-2xl font-bold">{player.name}</h1>

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
              <div className="font-medium">{fmtDate(earliestDue)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Latest due</div>
              <div className="font-medium">{fmtDate(latestDue)}</div>
            </div>
          </CardContent>
        )}
      </Card>

      {loadingRows ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Unpaid
                </h2>
                <Badge variant="secondary">{unpaid.length}</Badge>
              </div>
              {unpaid.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setChecked(
                      allSelected
                        ? new Set()
                        : new Set(unpaid.map((r) => r.id)),
                    )
                  }
                  className="-mr-2 text-muted-foreground"
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </Button>
              )}
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

          {/* Spacer so the last rows can scroll clear of the floating bar. */}
          {checked.size > 0 && <div className="h-16" aria-hidden />}
        </>
      )}

      {/* Floating action button — sits above the mobile home bar; the
          transparent gutter is click-through so it doesn't block scrolling. */}
      {checked.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="mx-auto max-w-2xl">
            <Button
              onClick={() => setPaid([...checked], true)}
              className="pointer-events-auto w-full bg-green-600 hover:bg-green-700 text-white h-11 text-base shadow-lg shadow-green-600/30"
            >
              Mark {checked.size} paid · {formatCents(checkedTotal)}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
