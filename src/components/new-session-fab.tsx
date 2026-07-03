"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { NewSessionForm } from "@/components/new-session-form";

export function NewSessionFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // No FAB on the login screen.
  if (pathname === "/login") return null;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          aria-label="New session"
          className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 size-14 rounded-full shadow-lg"
        >
          <Plus className="size-6" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[85vh]">
        <DrawerHeader className="text-left shrink-0">
          <DrawerTitle>New session</DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 flex-1 px-4 pb-8">
          <NewSessionForm fill onSuccess={() => setOpen(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
