"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Users,
  Moon,
  Sun,
  Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/players", label: "Players", icon: Users },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // Icons swap purely via the `.dark` class (set by next-themes before paint),
  // so there's no hydration mismatch and no setState-in-effect needed.
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="text-muted-foreground"
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  // No nav on the login screen.
  if (pathname === "/login") return null;

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

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
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          aria-label="Log out"
          className="text-muted-foreground"
        >
          <Power className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
