"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon, DollarSign, Plus, Receipt, Search, Users } from "lucide-react";
import { mutate } from "swr";
import { useTrackedSWR } from "@/lib/use-tracked-swr";
import type { Player } from "@/db/schema";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  ListCard,
  ListRow,
  ListRowAvatar,
  ListRowCheckbox,
} from "@/components/list-card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

// Parse a YYYY-MM-DD string into a Date in local time (avoids UTC drift).
function parseDateStr(s: string): Date | undefined {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function NewSessionForm({
  onSuccess,
  fill = false,
  session,
}: {
  onSuccess?: () => void;
  /** Fill the parent's height and scroll only the player list (drawer mode). */
  fill?: boolean;
  /** When provided, the form edits this session instead of creating one. */
  session?: {
    id: number;
    date: string; // YYYY-MM-DD
    rate: number; // cents
    playerIds: number[];
  };
}) {
  const router = useRouter();
  const editing = session != null;
  const PLAYERS_KEY = "/api/players";
  const { data: playersData } = useTrackedSWR<{ players: Player[] }>(
    PLAYERS_KEY,
  );
  const players = useMemo(() => playersData?.players ?? [], [playersData]);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(session?.playerIds ?? []),
  );
  // Defaults to "" (not today's date) when creating: reading the current
  // date during render would bake "today" into the prerendered HTML, which
  // then goes stale — see the useEffect below instead.
  const [date, setDate] = useState(session ? session.date : "");
  const [dateOpen, setDateOpen] = useState(false);
  const [rate, setRate] = useState(
    session ? (session.rate / 100).toString() : "",
  ); // dollar string
  const [rateInvalid, setRateInvalid] = useState(false);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [listScroll, setListScroll] = useState({ top: false, bottom: false });
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Prefill the rate and date only when creating a new session — this runs
    // in the browser only, never during prerendering.
    if (!editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(todayStr());
      fetch("/api/sessions/last-rate")
        .then((r) => r.json())
        .then((d) => {
          // Prefill with the last session's rate, or fall back to $10.
          setRate(typeof d.rate === "number" ? (d.rate / 100).toString() : "10");
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, search]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addAndSelect() {
    const name = search.trim();
    if (!name) return;
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.player) {
      mutate(
        PLAYERS_KEY,
        (curr: { players: Player[] } | undefined) => ({
          players: [...(curr?.players ?? []), data.player].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        }),
        { revalidate: false },
      );
      setSelected((prev) => new Set(prev).add(data.player.id));
      setSearch("");
    }
  }

  const exactExists = players.some(
    (p) => p.name.toLowerCase() === search.trim().toLowerCase(),
  );
  const canAddNew = search.trim().length > 0 && !exactExists;

  function updateListScroll() {
    const el = listScrollRef.current;
    if (!el) return;
    setListScroll({
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    });
  }

  useEffect(() => {
    updateListScroll();
  }, [filtered.length, canAddNew]);

  async function submit() {
    setError("");
    const cents = parseDollarsToCents(rate);
    if (cents === null) {
      setRateInvalid(true);
      rateInputRef.current?.focus();
      rateInputRef.current?.select();
      return;
    }
    setSubmitting(true);
    const res = await fetch(
      editing ? `/api/sessions/${session!.id}` : "/api/sessions",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, rate: cents, playerIds: [...selected] }),
      },
    );
    setSubmitting(false);
    if (res.ok) {
      mutate("/api/overview");
      mutate("/api/sessions");
      for (const pid of selected) {
        mutate(`/api/attendances?playerId=${pid}`);
      }
      if (editing) mutate(`/api/attendances?sessionId=${session!.id}`);
      router.refresh();
      if (onSuccess) onSuccess();
      else router.push("/");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(
        d.error ?? `Could not ${editing ? "update" : "create"} session.`,
      );
    }
  }

  const cents = parseDollarsToCents(rate);

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        fill && "h-full min-h-0",
      )}
    >
      <div className="flex gap-3 shrink-0">
        <Field className="flex-1">
          <FieldLabel htmlFor="date">Date</FieldLabel>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                className="justify-start font-normal bg-raised"
              >
                <CalendarIcon className="size-4 text-muted-foreground" />
                {parseDateStr(date)
                  ? format(parseDateStr(date)!, "d MMM yyyy")
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseDateStr(date)}
                onSelect={(d) => {
                  if (d) setDate(toDateStr(d));
                  setDateOpen(false);
                }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </Field>
        <Field className="w-32">
          <FieldLabel htmlFor="rate">Rate</FieldLabel>
          <div className="relative">
            <DollarSign className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={rateInputRef}
              id="rate"
              type="text"
              inputMode="decimal"
              value={rate}
              onChange={(e) => {
                setRate(e.target.value);
                setRateInvalid(false);
              }}
              placeholder="10.00"
              aria-invalid={rateInvalid}
              className="bg-raised pl-7"
            />
          </div>
        </Field>
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search or add players"
          className="h-8 rounded-full border pl-10 text-base"
        />
      </div>

      <div
        className={cn(
          "relative",
          fill ? "flex-1 min-h-0" : "h-[50vh]",
        )}
      >
        <div
          ref={listScrollRef}
          onScroll={updateListScroll}
          className="h-full overflow-y-auto rounded-2xl"
        >
          {filtered.length === 0 && !canAddNew ? (
            <Empty className="min-h-full border rounded-xl">
              <EmptyHeader>
                <EmptyTitle>No players yet</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ListCard className="min-h-full shadow-none">
              {canAddNew && (
                <div
                  role="button"
                  onClick={addAndSelect}
                  className="cursor-pointer select-none"
                >
                  <ListRow
                    icon={
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Plus className="size-4" />
                      </span>
                    }
                    title={
                      <>
                        Add &ldquo;{search.trim()}&rdquo; as a new player
                      </>
                    }
                    className="w-full py-1.5"
                  />
                </div>
              )}
              {filtered.map((p) => {
                const on = selected.has(p.id);
                return (
                  <div
                    key={p.id}
                    role="button"
                    aria-pressed={on}
                    onClick={() => toggle(p.id)}
                    className={cn("cursor-pointer select-none", on && "bg-primary/5")}
                  >
                    <ListRow
                      icon={<ListRowAvatar name={p.name} />}
                      title={p.name}
                      trailing={<ListRowCheckbox checked={on} />}
                      className="w-full py-1.5"
                    />
                  </div>
                );
              })}
            </ListCard>
          )}
        </div>

        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-2xl bg-linear-to-b from-black/4 to-transparent transition-opacity",
            listScroll.top ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-linear-to-t from-black/4 to-transparent transition-opacity",
            listScroll.bottom ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      {error && (
        <p className="text-destructive text-sm shrink-0">{error}</p>
      )}

      <div className="flex items-center justify-between shrink-0 px-1 text-sm">
        <Receipt className="size-4 text-muted-foreground" />
        <span className="font-semibold text-foreground tabular-nums">
          Total {cents !== null ? formatCents(cents * selected.size) : formatCents(0)}
        </span>
      </div>

      <Button
        onClick={submit}
        disabled={submitting || selected.size === 0}
        className="w-full h-11 rounded-full text-base shadow-lg shrink-0"
      >
        {selected.size === 0 ? (
          "Select players"
        ) : submitting ? (
          editing ? "Saving…" : "Creating…"
        ) : (
          <span className="flex items-center justify-center gap-1.5">
            {editing ? "Save changes" : "Create session"}
            <span className="opacity-60">·</span>
            <Users className="size-4" />
            {selected.size}
          </span>
        )}
      </Button>
    </div>
  );
}
