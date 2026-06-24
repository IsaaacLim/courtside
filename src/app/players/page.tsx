"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  // Rename dialog state.
  const [renameTarget, setRenameTarget] = useState<Player | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Merge dialog state.
  const [mergeSource, setMergeSource] = useState<Player | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(
      `/api/players?includeInactive=${includeInactive ? "1" : "0"}`,
    );
    const data = await res.json();
    setPlayers(data.players ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    await fetch("/api/players", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    load();
  }

  function openRename(p: Player) {
    setRenameTarget(p);
    setRenameValue(p.name);
  }

  async function doRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    await fetch(`/api/players/${renameTarget.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setRenameTarget(null);
    load();
  }

  async function toggleActive(p: Player) {
    await fetch(`/api/players/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    load();
  }

  const mergeTarget =
    players.find((p) => String(p.id) === mergeTargetId) ?? null;
  const mergeOthers = mergeSource
    ? players.filter((p) => p.id !== mergeSource.id)
    : [];

  function openMerge(p: Player) {
    setMergeSource(p);
    setMergeTargetId("");
  }

  async function doMerge() {
    if (!mergeSource || !mergeTarget) return;
    await fetch(`/api/players/${mergeSource.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mergeIntoId: mergeTarget.id }),
    });
    setMergeConfirmOpen(false);
    setMergeSource(null);
    setMergeTargetId("");
    load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Players</h1>

      <form onSubmit={addPlayer} className="flex gap-2 mb-4">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a player"
          className="flex-1"
        />
        <Button type="submit" disabled={!newName.trim()}>
          Add
        </Button>
      </form>

      <div className="flex items-center gap-2 mb-3">
        <Checkbox
          id="show-inactive"
          checked={includeInactive}
          onCheckedChange={(c) => setIncludeInactive(c === true)}
        />
        <Label htmlFor="show-inactive" className="text-muted-foreground">
          Show inactive
        </Label>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : players.length === 0 ? (
        <p className="text-muted-foreground">No players yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border bg-card">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <span
                className={cn(
                  "truncate",
                  !p.active && "text-muted-foreground line-through",
                )}
              >
                {p.name}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openRename(p)}
                >
                  Rename
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => openMerge(p)}
                >
                  Merge
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => toggleActive(p)}
                >
                  {p.active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Rename dialog */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename player</DialogTitle>
            <DialogDescription>
              Enter a new name for {renameTarget?.name}.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doRename();
            }}
          >
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog
        open={mergeSource !== null}
        onOpenChange={(o) => {
          if (!o) {
            setMergeSource(null);
            setMergeTargetId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge {mergeSource?.name}</DialogTitle>
            <DialogDescription>
              Choose the player to merge into. All of {mergeSource?.name}&rsquo;s
              sessions move to them, and {mergeSource?.name} is deleted.
            </DialogDescription>
          </DialogHeader>
          <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a player…" />
            </SelectTrigger>
            <SelectContent>
              {mergeOthers.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMergeSource(null);
                setMergeTargetId("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!mergeTarget}
              onClick={() => setMergeConfirmOpen(true)}
            >
              Merge…
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge confirmation */}
      <AlertDialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge players?</AlertDialogTitle>
            <AlertDialogDescription>
              Merge &ldquo;{mergeSource?.name}&rdquo; into &ldquo;
              {mergeTarget?.name}&rdquo;? All of {mergeSource?.name}&rsquo;s
              sessions move to {mergeTarget?.name}, and {mergeSource?.name} is
              deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doMerge}>Merge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
