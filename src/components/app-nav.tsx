"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/sessions", label: "Sessions" },
  { href: "/payments", label: "Payments" },
  { href: "/players", label: "Players" },
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
    <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur">
      <div className="max-w-2xl mx-auto flex items-center">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 text-center py-3 text-sm font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
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
