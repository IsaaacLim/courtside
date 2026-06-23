"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/sessions/new", label: "New" },
  { href: "/payments", label: "Payments" },
  { href: "/players", label: "Players" },
];

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
    <nav className="fixed bottom-0 inset-x-0 border-t border-neutral-200 bg-white">
      <div className="max-w-2xl mx-auto flex">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 text-center py-3 text-sm font-medium ${
                active ? "text-blue-600" : "text-neutral-500"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        <button
          onClick={logout}
          className="px-4 py-3 text-sm font-medium text-neutral-400"
          aria-label="Log out"
        >
          ⏻
        </button>
      </div>
    </nav>
  );
}
