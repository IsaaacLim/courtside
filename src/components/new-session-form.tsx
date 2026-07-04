"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
import type { Player } from "@/db/schema";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { notifyDataChanged } from "@/hooks/use-data-refresh";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
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
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(session?.playerIds ?? []),
  );
  const [date, setDate] = useState(session ? session.date : todayStr());
  const [dateOpen, setDateOpen] = useState(false);
  const [rate, setRate] = useState(
    session ? (session.rate / 100).toString() : "",
  ); // dollar string
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadPlayers() {
    const res = await fetch("/api/players");
    const data = await res.json();
    setPlayers(data.players ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlayers();
    // Prefill the rate from the last session only when creating a new one.
    if (!editing) {
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
      setPlayers((prev) =>
        [...prev, data.player].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSelected((prev) => new Set(prev).add(data.player.id));
      setSearch("");
    }
  }

  const exactExists = players.some(
    (p) => p.name.toLowerCase() === search.trim().toLowerCase(),
  );
  const canAddNew = search.trim().length > 0 && !exactExists;

  async function submit() {
    setError("");
    const cents = parseDollarsToCents(rate);
    if (cents === null) {
      setError("Enter a valid rate.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one player.");
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
      notifyDataChanged();
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
                className="justify-start font-normal"
              >
                <CalendarIcon className="size-4" />
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
          <FieldLabel htmlFor="rate">Rate ($)</FieldLabel>
          <Input
            id="rate"
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="10.00"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between shrink-0">
        <Badge variant="secondary">{selected.size} selected</Badge>
        {cents !== null && selected.size > 0 && (
          <span className="text-sm text-muted-foreground">
            Total {formatCents(cents * selected.size)}
          </span>
        )}
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search or add a player"
        className="shrink-0"
      />

      {canAddNew && (
        <Button
          variant="outline"
          onClick={addAndSelect}
          className="w-full justify-start border-dashed shrink-0"
        >
          <Plus className="size-4" />
          Add &ldquo;{search.trim()}&rdquo; as a new player
        </Button>
      )}

      <div
        className={cn(
          "overflow-y-auto rounded-xl border bg-muted/30 p-2",
          fill ? "flex-1 min-h-0" : "h-[50vh]",
        )}
      >
        {filtered.length === 0 ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyTitle>No players</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup>
            {filtered.map((p) => {
              const on = selected.has(p.id);
              return (
                <Item key={p.id} asChild variant={on ? "muted" : "outline"}>
                  <label>
                    <Checkbox
                      checked={on}
                      onCheckedChange={() => toggle(p.id)}
                      className="size-5"
                    />
                    <ItemContent>
                      <ItemTitle>{p.name}</ItemTitle>
                    </ItemContent>
                  </label>
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </div>

      {error && (
        <p className="text-destructive text-sm shrink-0">{error}</p>
      )}

      <Button
        onClick={submit}
        disabled={submitting || selected.size === 0}
        className="w-full h-11 text-base shrink-0"
      >
        {editing
          ? submitting
            ? "Saving…"
            : "Save changes"
          : submitting
            ? "Creating…"
            : "Create session"}
      </Button>
    </div>
  );
}
