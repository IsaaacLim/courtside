"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, Power } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MorePage() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">More</h1>

      {/* Icon + label swap purely via the `.dark` class to avoid hydration
          mismatch (next-themes sets the class before paint). */}
      <Button
        variant="outline"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="w-full justify-start h-12"
      >
        <Sun className="hidden size-4 dark:block" />
        <Moon className="size-4 dark:hidden" />
        <span className="dark:hidden">Switch to dark mode</span>
        <span className="hidden dark:inline">Switch to light mode</span>
      </Button>

      <Button
        variant="outline"
        onClick={logout}
        className="w-full justify-start h-12 text-destructive hover:text-destructive"
      >
        <Power className="size-4" />
        Log out
      </Button>
    </div>
  );
}
