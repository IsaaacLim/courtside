"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoundIconButton } from "@/components/ui/round-icon-button";
import { cn } from "@/lib/utils";
import { NewSessionForm } from "@/components/new-session-form";
import { useBackDismiss } from "@/lib/use-back-dismiss";

export function NewSessionFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useBackDismiss(open, close);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // No FAB on the login screen.
  if (pathname === "/login") return null;

  // On the "More" page, shrink + fade the button out (kept mounted so the
  // transition can play) rather than removing it abruptly.
  const hidden = pathname === "/more";

  return (
    <>
      <Button
        aria-label="New session"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 size-14 rounded-full shadow-lg transition-all duration-300 ease-in-out",
          hidden && "scale-0 opacity-0 pointer-events-none",
        )}
      >
        <Plus className="size-6" />
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="new-session"
            role="dialog"
            aria-modal="true"
            aria-label="New session"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22 } }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.15, ease: "easeIn" } }}
            className="fixed inset-0 z-50 flex flex-col bg-background"
          >
            <div className="grid shrink-0 grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8">
              <RoundIconButton aria-label="Back" onClick={close}>
                <ChevronLeft className="size-5" />
              </RoundIconButton>
              <h1 className="text-center text-lg font-bold">New session</h1>
              <div aria-hidden />
            </div>
            <div className="min-h-0 flex-1 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <NewSessionForm fill onSuccess={close} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
