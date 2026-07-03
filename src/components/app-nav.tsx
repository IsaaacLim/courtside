"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Ellipsis,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/players", label: "Players", icon: Users },
  { href: "/more", label: "More", icon: Ellipsis },
];

export function AppNav() {
  const pathname = usePathname();

  // No nav on the login screen.
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 rounded-t-2xl border-t border-x border-border bg-background/95 backdrop-blur shadow-[0_-4px_16px_-6px_rgba(0,0,0,0.12)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto flex items-center">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-4 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
