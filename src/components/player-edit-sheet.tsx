"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Merge, Pencil, Search, Trash2, TriangleAlert } from "lucide-react";
import { useBackDismiss } from "@/lib/use-back-dismiss";
import type { Player } from "@/db/schema";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListCard, ListRow, ListRowAvatar } from "@/components/list-card";
import { ScrollShadowList } from "@/components/scroll-shadow-list";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type PlayerRow = Player & { owed: number; sessionCount: number };

// One of 3 messages depending on what's attached to the player being deleted,
// leading with the fact that matters most (safe / session count / amount owed).
export function DeleteMessage({ p }: { p: PlayerRow }) {
  if (p.sessionCount === 0) {
    return (
      <>
        <span className="block font-semibold text-foreground">Safe to delete.</span>
        <span className="mt-1 block">Not connected to any session.</span>
      </>
    );
  }
  const sessions = `${p.sessionCount} ${p.sessionCount === 1 ? "session" : "sessions"}`;
  if (p.owed > 0) {
    return (
      <>
        <span className="block font-semibold text-foreground">
          {formatCents(p.owed)} owed across {sessions}.
        </span>
        <span className="mt-1 block">
          Deleting removes {p.name} completely. That balance and those sessions
          will be removed from the totals.
        </span>
      </>
    );
  }
  return (
    <>
      <span className="block font-semibold text-foreground">{sessions}, fully paid.</span>
      <span className="mt-1 block">
        Deleting removes {p.name} completely from those sessions and the totals.
      </span>
    </>
  );
}

type Mode = "menu" | "rename" | "merge";
type Nav = { mode: Mode; direction: 1 | -1 };

const SLIDE_TRANSITION = { duration: 0.22, ease: "easeInOut" } as const;

// +1 (menu -> a subview) slides the incoming view in from the right and the
// outgoing one out to the left; -1 (subview -> menu) is the mirror of that.
const slideVariants = {
  enter: (direction: 1 | -1) => ({ x: direction > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 1 | -1) => ({ x: direction > 0 ? -24 : 24, opacity: 0 }),
};

// Merge (always) and Rename (once expanded — see `mergeExpanded` and
// `renameExpanded` below) drive their own fixed height instead of
// MeasuredPanel's content measurement, so `onHeight` becomes a no-op for
// them — stable across renders so MeasuredPanel's ResizeObserver effect
// doesn't tear down and resubscribe every render.
function noop() {}

// Target frames for Merge/Rename, expressed as a CSS `min()` of a flat px
// number and a `dvh` percentage — not a plain px number. The root layout's
// `interactiveWidget: "resizes-content"` (see app/layout.tsx) makes the
// browser genuinely shrink the viewport to the visible area above the
// on-screen keyboard, which is what correctly repositions this
// `position: fixed` sheet — but it also means a *plain* fixed px height (no
// dvh/vh at all) can now be taller than that shrunk viewport and overflow
// past the sheet's own edges (DrawerContent has no `overflow-hidden`, so
// that overflow bleeds off-screen rather than clipping). The px number is
// still the *target* on a normal, keyboard-closed viewport; the `dvh` term
// only kicks in as a ceiling once the keyboard eats enough space to matter.
function sheetHeight(px: number): string {
  return `min(${px}px, 78dvh)`;
}
const SHEET_HEIGHT_MID = 520; // Merge's fixed frame before its search input is focused.
const SHEET_HEIGHT_TALL = 760; // Merge's/Rename's frame once an input is focused.

// Reports its rendered height to the parent so the sheet can animate a real
// `height` change (a reflow) instead of Motion's transform-based `layout`
// resize, which scales the whole subtree and visibly stretches/squishes
// plain (non-motion) children like text and icons mid-transition.
function MeasuredPanel({
  onHeight,
  className,
  children,
}: {
  onHeight: (height: number) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Re-measure with getBoundingClientRect on every callback rather than
    // trusting ResizeObserver's own entry: entry.contentRect is the
    // content box only (excludes this element's bottom padding), which
    // under-reports the height by exactly that padding.
    const report = () => onHeight(el.getBoundingClientRect().height);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHeight]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Bottom sheet opened by tapping a player row on /players. Consolidates
 * Rename, Merge, and Delete into one place instead of three separate row
 * buttons (which crowd out the name on mobile).
 */
export function PlayerEditSheet({
  player,
  players,
  onOpenChange,
  onRename,
  onMerge,
  onDelete,
}: {
  player: PlayerRow | null;
  players: PlayerRow[];
  onOpenChange: (open: boolean) => void;
  onRename: (id: number, name: string) => Promise<void>;
  onMerge: (sourceId: number, targetId: number) => Promise<void>;
  onDelete: (target: PlayerRow) => Promise<void>;
}) {
  useBackDismiss(player !== null, () => onOpenChange(false));

  // Rename/merge-search inputs focus themselves manually (see
  // onAnimationComplete below) instead of via `autoFocus`, so the keyboard
  // only opens once the slide/height transition has fully settled — vaul's
  // keyboard-open height computation reads the drawer's live height, so it
  // needs to run against the final size, not a mid-transition one.
  const subviewInputRef = useRef<HTMLInputElement>(null);

  // Keeps rendering the same player's content while the sheet animates
  // closed, instead of falling through to the empty case the instant
  // `player` is nulled out (still mounted mid-exit-animation). Adjusted
  // during render (React's recommended pattern for this) rather than in an
  // effect, so a newly-opened player's content is correct on the very first
  // render instead of one tick later.
  const [displayPlayer, setDisplayPlayer] = useState<PlayerRow | null>(player);
  const [nav, setNav] = useState<Nav>({ mode: "menu", direction: 1 });
  const [height, setHeight] = useState<number | string>();
  // Tracks the prop's own open/closed transitions, not just which player —
  // `displayPlayer` is intentionally left stale while the sheet is closing,
  // so comparing against it alone would miss a reopen of the *same* player
  // and leave `nav` stuck on whatever subview they'd navigated to before.
  const [lastPlayer, setLastPlayer] = useState(player);
  if (player !== lastPlayer) {
    setLastPlayer(player);
    if (player) {
      setDisplayPlayer(player);
      setNav({ mode: "menu", direction: 1 });
      // Otherwise the sheet reopens still holding the previous session's
      // measured height (e.g. the taller Merge view) and visibly animates
      // down to the menu's height instead of just opening at it.
      setHeight(undefined);
    }
  }
  const mode = nav.mode;

  function go(mode: Mode, direction: 1 | -1) {
    setNav({ mode, direction });
  }

  const [renameValue, setRenameValue] = useState("");
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  // One-way ratchet: focusing the search input grows the sheet to a fixed
  // height and it stays there (even once the keyboard closes) until Merge
  // is re-entered, matching Instagram/Messenger's fixed-frame keyboard UX.
  const [mergeExpanded, setMergeExpanded] = useState(false);
  // Same ratchet for Rename: its own content is short, so without this the
  // keyboard would cover the input/buttons on open. Growing to a fixed
  // height ourselves (same target as Merge's — see SHEET_HEIGHT_TALL above)
  // means the extra room just shows as blank space below the buttons.
  const [renameExpanded, setRenameExpanded] = useState(false);
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // These confirm dialogs are separate Radix Dialog roots stacked on top of
  // the sheet's own Drawer, so the back button needs its own dismiss layer
  // for each one — otherwise a back press pops the Drawer's history entry
  // (closing the sheet) while the confirm dialog, whose state is untouched,
  // is left dangling open with no sheet underneath it.
  useBackDismiss(mergeConfirmOpen, () => setMergeConfirmOpen(false));
  useBackDismiss(deleteConfirmOpen, () => setDeleteConfirmOpen(false));

  function openRename() {
    setRenameValue(displayPlayer?.name ?? "");
    setRenameExpanded(false);
    go("rename", 1);
  }

  async function saveRename() {
    if (!displayPlayer) return;
    const name = renameValue.trim();
    if (name && name !== displayPlayer.name) {
      await onRename(displayPlayer.id, name);
    }
    onOpenChange(false);
  }

  function openMerge() {
    setMergeSearch("");
    setMergeTargetId(null);
    setMergeExpanded(false);
    setHeight(sheetHeight(SHEET_HEIGHT_MID));
    go("merge", 1);
  }

  const mergeOthers = displayPlayer
    ? players.filter((p) => p.id !== displayPlayer.id)
    : [];
  const filteredOthers = mergeOthers.filter((p) =>
    p.name.toLowerCase().includes(mergeSearch.trim().toLowerCase()),
  );
  const mergeTarget = mergeOthers.find((p) => p.id === mergeTargetId) ?? null;

  async function confirmMerge() {
    if (!displayPlayer || !mergeTarget) return;
    await onMerge(displayPlayer.id, mergeTarget.id);
    setMergeConfirmOpen(false);
    onOpenChange(false);
  }

  async function confirmDelete() {
    if (!displayPlayer) return;
    await onDelete(displayPlayer);
    setDeleteConfirmOpen(false);
    onOpenChange(false);
  }

  return (
    <>
      <Drawer
        open={player !== null}
        onOpenChange={(o) => !o && onOpenChange(false)}
        // The root layout's `interactiveWidget: "resizes-content"` viewport
        // setting (see app/layout.tsx) makes the browser itself shrink the
        // layout viewport to match the visible area above the on-screen
        // keyboard, so this `position: fixed` sheet is correctly
        // repositioned by the browser with no JS involved. vaul's own
        // `repositionInputs` mechanism is a same-frame heuristic
        // (`visualViewport` resize polling + a caches-once-forever
        // "initial height" it restores on keyboard close) that exists to
        // fake this same behavior on pages that don't opt into that
        // viewport setting — with it in place, that heuristic is not just
        // redundant but actively harmful: it still runs and still mutates
        // this drawer's inline height/bottom, fighting the browser's own
        // (now correct) sizing. Disabling it removes that fight entirely.
        repositionInputs={false}
      >
        <DrawerContent className="bg-background data-[vaul-drawer-direction=bottom]:mt-2 data-[vaul-drawer-direction=bottom]:max-h-[min(92dvh,900px)]">
          {/*
            Merge/Rename's fixed frames are otherwise silently capped by the
            default max-h-[80vh] — the menu never got tall enough to notice.
            `min(92dvh, 900px)` mirrors `sheetHeight()` above: a `dvh`
            ceiling so this outer box shrinks along with the (now correctly
            resizing, see `interactiveWidget` in app/layout.tsx)
            keyboard-adjusted viewport, `min`-ed with a flat px ceiling as a
            sanity cap on large/desktop viewports where 92dvh alone would be
            excessive. Kept a few dvh points above `sheetHeight()`'s own 78dvh
            so this box has room for the header on top of the inner content.
          */}
          <DrawerHeader className="shrink-0">
            <DrawerTitle className="text-base">
              {displayPlayer?.name ?? ""}
            </DrawerTitle>
          </DrawerHeader>

          <div
            key={displayPlayer?.id}
            style={{
              // CSS transition shorthand needs the CSS keyword ("ease-in-out"),
              // not Motion's JS easing name ("easeInOut") — the browser
              // silently drops the whole declaration if it's invalid, which
              // makes the height snap instead of animating.
              height,
              transition: `height ${SLIDE_TRANSITION.duration}s ease-in-out`,
            }}
            className="relative overflow-y-auto overflow-x-hidden"
          >
            <AnimatePresence initial={false} custom={nav.direction} mode="popLayout">
              <motion.div
                key={mode}
                className="h-full"
                custom={nav.direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={SLIDE_TRANSITION}
                onAnimationComplete={(definition) => {
                  // Merge's search input deliberately doesn't auto-focus at
                  // all (only Rename does) — the keyboard should only open
                  // once the user taps it themselves, so the sheet can open
                  // at a calm SHEET_HEIGHT_MID instead of immediately
                  // fighting the keyboard for space.
                  if (definition === "center" && mode === "rename") {
                    // Ratchet Rename to the same fixed height as Merge's
                    // expanded state (SHEET_HEIGHT_TALL, not _MID — see its
                    // comment above for why these must match). The
                    // input+buttons sit near the top of that space, so the
                    // extra height just appears as blank space below them.
                    // Set before focusing so the height is already settled
                    // before the keyboard starts opening.
                    if (!renameExpanded) {
                      setRenameExpanded(true);
                      setHeight(sheetHeight(SHEET_HEIGHT_TALL));
                    }
                    subviewInputRef.current?.focus();
                  }
                }}
              >
                <MeasuredPanel
                  onHeight={
                    mode === "merge" || (mode === "rename" && renameExpanded)
                      ? noop
                      : setHeight
                  }
                  className={cn(
                    "px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]",
                    // Merge is given its own fixed height (h-full, filling
                    // the wrapper's fixed SHEET_HEIGHT_MID/_TALL) instead of
                    // being measured, so its player list can flex to fill
                    // the space below the search bar.
                    mode === "merge" && "h-full",
                  )}
                >
                {mode === "menu" && (
                  <ListCard>
                    <div role="button" onClick={openRename} className="cursor-pointer select-none">
                      <ListRow
                        icon={
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                            <Pencil className="size-4" />
                          </div>
                        }
                        title="Rename"
                        chevron
                        className="w-full py-2.5"
                      />
                    </div>
                    <div role="button" onClick={openMerge} className="cursor-pointer select-none">
                      <ListRow
                        icon={
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                            <Merge className="size-4" />
                          </div>
                        }
                        title="Merge into another player"
                        chevron
                        className="w-full py-2.5"
                      />
                    </div>
                    <div
                      role="button"
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="cursor-pointer select-none"
                    >
                      <ListRow
                        icon={
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                            <Trash2 className="size-4" />
                          </div>
                        }
                        title={<span className="text-destructive">Delete</span>}
                        className="w-full py-2.5"
                      />
                    </div>
                  </ListCard>
                )}

                {mode === "rename" && (
                  <div className="space-y-4">
                    <Input
                      ref={subviewInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() => go("menu", -1)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="h-11"
                        disabled={!renameValue.trim()}
                        onClick={saveRename}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}

                {mode === "merge" && (
                  <div className="flex h-full flex-col gap-3">
                    <div className="relative shrink-0">
                      <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={subviewInputRef}
                        value={mergeSearch}
                        onChange={(e) => setMergeSearch(e.target.value)}
                        onFocus={() => {
                          if (!mergeExpanded) {
                            setMergeExpanded(true);
                            setHeight(sheetHeight(SHEET_HEIGHT_TALL));
                          }
                        }}
                        placeholder="Search players"
                        className="h-8 rounded-full border pl-10 text-base"
                      />
                    </div>
                    {filteredOthers.length === 0 ? (
                      <Empty className="border rounded-xl py-8">
                        <EmptyHeader>
                          <EmptyTitle>
                            {mergeOthers.length === 0
                              ? "No other players to merge into"
                              : "No matches"}
                          </EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    ) : (
                      <ScrollShadowList
                        containerClassName="flex-1 min-h-0"
                        scrollClassName="h-full"
                        scrollDeps={[filteredOthers.length]}
                      >
                        <ListCard className="shadow-none">
                          {filteredOthers.map((p) => {
                            const on = p.id === mergeTargetId;
                            return (
                              <div
                                key={p.id}
                                role="button"
                                aria-pressed={on}
                                onClick={() => setMergeTargetId(p.id)}
                                className={cn("cursor-pointer select-none", on && "bg-primary/5")}
                              >
                                <ListRow
                                  icon={<ListRowAvatar name={p.name} colorKey={String(p.id)} />}
                                  title={p.name}
                                  trailing={
                                    on ? <Check className="size-4 text-primary" /> : undefined
                                  }
                                  className="w-full py-1.5"
                                />
                              </div>
                            );
                          })}
                        </ListCard>
                      </ScrollShadowList>
                    )}
                    <div className="grid shrink-0 grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() => go("menu", -1)}
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        className="h-11"
                        disabled={!mergeTarget}
                        onClick={() => setMergeConfirmOpen(true)}
                      >
                        Merge
                      </Button>
                    </div>
                  </div>
                )}
              </MeasuredPanel>
              </motion.div>
            </AnimatePresence>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Merge confirmation */}
      <AlertDialog open={mergeConfirmOpen} onOpenChange={setMergeConfirmOpen}>
        <AlertDialogContent
          onPointerDown={(e) => {
            // This dialog is portalled outside the Drawer's DOM, so a press
            // in here (eg. Cancel) still bubbles up to the document listener
            // Radix's DismissableLayer uses to detect "outside" presses for
            // the Drawer's own layer. Radix defers that check to the
            // following click event, by which point our onClick has already
            // closed this dialog — so any state-based guard here is already
            // stale. Stopping propagation at the source is what actually
            // keeps the press from ever being seen as outside the Drawer.
            e.stopPropagation();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Merge players?</AlertDialogTitle>
            <AlertDialogDescription>
              Merge &ldquo;{displayPlayer?.name}&rdquo; into &ldquo;
              {mergeTarget?.name}&rdquo;? All of {displayPlayer?.name}&rsquo;s
              sessions move to {mergeTarget?.name}, and {displayPlayer?.name} is
              deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMerge}>Merge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent
          className="max-w-xs rounded-2xl"
          showCloseButton={false}
          onPointerDown={(e) => {
            // See the matching comment on the merge confirm dialog above:
            // stops a press in here (eg. Cancel) from bubbling to the
            // document listener the Drawer's DismissableLayer uses to
            // detect outside presses, since that check is deferred to the
            // following click — after this dialog has already closed
            // itself — so it can't be caught with a state-based guard.
            e.stopPropagation();
          }}
        >
          <DialogHeader className="items-center text-center">
            <AlertDialogMedia
              className={`size-20 ${
                displayPlayer?.sessionCount === 0
                  ? "bg-transparent text-chart-4"
                  : displayPlayer && displayPlayer.owed > 0
                    ? "bg-transparent text-destructive"
                    : "bg-transparent text-chart-5"
              }`}
            >
              {displayPlayer?.sessionCount === 0 ? (
                <Trash2 className="size-14" />
              ) : (
                <TriangleAlert className="size-14" />
              )}
            </AlertDialogMedia>
            <DialogTitle>Delete {displayPlayer?.name}?</DialogTitle>
            <DialogDescription>
              {displayPlayer && <DeleteMessage p={displayPlayer} />}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 rounded-b-2xl">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button className="h-11" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
