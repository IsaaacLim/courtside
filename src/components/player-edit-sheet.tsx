"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

  // vaul's `repositionInputs` shrinks the drawer's DOM node directly
  // (bypassing our own `height` state below) while a text input is
  // focused, then on keyboard-close snaps it back to a height it cached
  // the *first* time this ever fired for this mounted Drawer.Root — and
  // never re-caches, for the component's lifetime. That's fine the first
  // time, but wrong for every subview navigated to afterwards. There's no
  // public API to invalidate that cache, so on every keyboard-close we
  // clear vaul's inline styles ourselves and let the still-correct
  // `height` state (and the drawer's own layout classes) take back over.
  const drawerContentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!player) return;
    function onViewportResize() {
      const vv = window.visualViewport;
      const el = drawerContentRef.current;
      if (!vv || !el) return;
      const keyboardClosed = window.innerHeight - vv.height < 60;
      if (keyboardClosed) {
        el.style.height = "";
        el.style.bottom = "";
      }
    }
    window.visualViewport?.addEventListener("resize", onViewportResize);
    return () =>
      window.visualViewport?.removeEventListener("resize", onViewportResize);
  }, [player]);

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
  const [height, setHeight] = useState<number>();
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
      >
        <DrawerContent ref={drawerContentRef} className="bg-background">
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
                custom={nav.direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={SLIDE_TRANSITION}
                onAnimationComplete={(definition) => {
                  if (definition === "center" && mode !== "menu") {
                    subviewInputRef.current?.focus();
                  }
                }}
              >
                <MeasuredPanel
                  onHeight={setHeight}
                  className="px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]"
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
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={subviewInputRef}
                        value={mergeSearch}
                        onChange={(e) => setMergeSearch(e.target.value)}
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
                        scrollClassName="max-h-[45vh]"
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
                    <div className="grid grid-cols-2 gap-2">
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
