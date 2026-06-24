"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCents } from "@/lib/money";
import { Card } from "@/components/ui/card";

type Overview = {
  totalOutstanding: number;
  totalCollected: number;
  playerBalances: {
    playerId: number;
    name: string;
    owed: number;
    unpaid: number;
    sessions: number;
  }[];
  sessions: {
    sessionId: number;
    date: string;
    rate: number;
    total: number;
    paid: number;
  }[];
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!data)
    return <p className="text-destructive">Could not load overview.</p>;

  const owing = data.playerBalances.filter((p) => p.owed > 0);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Overview</h1>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="p-4 gap-1">
          <div className="text-sm text-muted-foreground">Outstanding</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCents(data.totalOutstanding)}
          </div>
        </Card>
        <Card className="p-4 gap-1">
          <div className="text-sm text-muted-foreground">Collected</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCents(data.totalCollected)}
          </div>
        </Card>
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground mb-2">
        Who owes ({owing.length})
      </h2>
      {owing.length === 0 ? (
        <p className="text-muted-foreground mb-6">Everyone&rsquo;s settled. 🎉</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border bg-card mb-6">
          {owing.map((p) => (
            <li key={p.playerId}>
              <Link
                href="/payments"
                className="flex items-center justify-between px-3 py-3"
              >
                <div>
                  <div>{p.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.unpaid} unpaid {p.unpaid === 1 ? "session" : "sessions"}
                  </div>
                </div>
                <div className="font-semibold text-red-600 dark:text-red-400">
                  {formatCents(p.owed)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-sm font-semibold text-muted-foreground mb-2">
        Recent sessions
      </h2>
      {data.sessions.length === 0 ? (
        <p className="text-muted-foreground">
          No sessions yet.{" "}
          <Link href="/sessions/new" className="text-primary underline-offset-4 hover:underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border bg-card">
          {data.sessions.map((s) => (
            <li
              key={s.sessionId}
              className="flex items-center justify-between px-3 py-3"
            >
              <div>
                <div>{fmtDate(s.date)}</div>
                <div className="text-sm text-muted-foreground">
                  {formatCents(s.rate)} · {s.total}{" "}
                  {s.total === 1 ? "player" : "players"}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {s.paid}/{s.total} paid
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
