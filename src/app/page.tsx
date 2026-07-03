"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatCents } from "@/lib/money";
import { useDataRefresh } from "@/hooks/use-data-refresh";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

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

  async function load() {
    const d = await fetch("/api/overview").then((r) => r.json());
    setData(d);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  useDataRefresh(load);

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-6" />
      </div>
    );
  if (!data)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Could not load overview</EmptyTitle>
          <EmptyDescription>Check your connection and retry.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const owing = data.playerBalances.filter((p) => p.owed > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" />

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardDescription>Outstanding</CardDescription>
            <CardTitle className="text-2xl text-red-600 dark:text-red-400">
              {formatCents(data.totalOutstanding)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Collected</CardDescription>
            <CardTitle className="text-2xl text-green-600 dark:text-green-400">
              {formatCents(data.totalCollected)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Who owes
          </h2>
          <Badge variant="secondary">{owing.length}</Badge>
        </div>
        {owing.length === 0 ? (
          <Empty className="border rounded-xl py-8">
            <EmptyHeader>
              <EmptyTitle>Everyone&rsquo;s settled 🎉</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup>
            {owing.map((p) => (
              <Item key={p.playerId} asChild variant="outline">
                <Link href="/payments">
                  <ItemContent>
                    <ItemTitle>{p.name}</ItemTitle>
                    <ItemDescription>
                      {p.unpaid} unpaid{" "}
                      {p.unpaid === 1 ? "session" : "sessions"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {formatCents(p.owed)}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </ItemActions>
                </Link>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Recent sessions
        </h2>
        {data.sessions.length === 0 ? (
          <Empty className="border rounded-xl py-8">
            <EmptyHeader>
              <EmptyTitle>No sessions yet</EmptyTitle>
              <EmptyDescription>
                <Link href="/sessions/new" className="text-primary underline-offset-4 hover:underline">
                  Create one
                </Link>{" "}
                to get started.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup>
            {data.sessions.map((s) => (
              <Item key={s.sessionId} asChild variant="outline">
                <Link href="/sessions">
                  <ItemContent>
                    <ItemTitle>{fmtDate(s.date)}</ItemTitle>
                    <ItemDescription>
                      {formatCents(s.rate)} · {s.total}{" "}
                      {s.total === 1 ? "player" : "players"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant="secondary">
                      {s.paid}/{s.total} paid
                    </Badge>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </ItemActions>
                </Link>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>
    </div>
  );
}
