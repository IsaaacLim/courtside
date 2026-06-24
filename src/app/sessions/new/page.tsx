"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Player } from "@/db/schema";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
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

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function NewSessionPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [date, setDate] = useState(todayStr());
  const [rate, setRate] = useState(""); // dollar string
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
    fetch("/api/sessions/last-rate")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.rate === "number") setRate((d.rate / 100).toString());
      });
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
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, rate: cents, playerIds: [...selected] }),
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not create session.");
    }
  }

  const cents = parseDollarsToCents(rate);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">New session</h1>

      <div className="flex gap-3">
        <Field className="flex-1">
          <FieldLabel htmlFor="date">Date</FieldLabel>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
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

      <div className="flex items-center justify-between">
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
      />

      {canAddNew && (
        <Button
          variant="outline"
          onClick={addAndSelect}
          className="w-full justify-start border-dashed"
        >
          <Plus className="size-4" />
          Add &ldquo;{search.trim()}&rdquo; as a new player
        </Button>
      )}

      {filtered.length === 0 ? (
        <Empty className="border rounded-xl py-10">
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

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button
        onClick={submit}
        disabled={submitting || selected.size === 0}
        className="w-full h-11 text-base"
      >
        {submitting ? "Creating…" : "Create session"}
      </Button>
    </div>
  );
}
