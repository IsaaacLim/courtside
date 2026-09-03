"use client";

import { useState } from "react";
import { mutate } from "swr";
import { useTrackedSWR } from "@/lib/use-tracked-swr";
import { useScrollRestoration } from "@/lib/use-scroll-restoration";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { PageHeader } from "@/components/page-header";
import {
  ExpandOverlay,
  ExpandTrigger,
  useExpandNudge,
} from "@/components/expanding-detail";
import { ListCard, ListRow } from "@/components/list-card";
import { SessionDetail, type SessionSummary } from "@/components/session-detail";
import { Badge } from "@/components/ui/badge";
import { CenteredSpinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { User, Users } from "lucide-react";

function SessionList({
  sessions,
  nudge,
  onOpen,
}: {
  sessions: SessionSummary[];
  nudge: { id: string | number | null; y: number };
  onOpen: (s: SessionSummary, y: number) => void;
}) {
  if (sessions.length === 0) {
    return (
      <Empty className="border rounded-xl py-10">
        <EmptyHeader>
          <EmptyTitle>Nothing here</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ListCard>
      {sessions.map((s) => (
        <ExpandTrigger
          key={s.id}
          layoutId={`session-${s.id}`}
          nudge={nudge}
          onOpen={(y) => onOpen(s, y)}
          surfaceClassName="border-transparent bg-card"
          className="rounded-none p-0"
        >
          <ListRow
            icon={
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                {s.total === 1 ? (
                  <User className="size-4" />
                ) : (
                  <Users className="size-4" />
                )}
              </div>
            }
            title={formatDate(s.date)}
            subtitle={`${formatCents(s.rate)} · ${s.total} ${s.total === 1 ? "player" : "players"}`}
            trailing={
              s.unpaid > 0 ? (
                <Badge variant="destructive">{s.unpaid} unpaid</Badge>
              ) : (
                <Badge variant="secondary">Paid</Badge>
              )
            }
            chevron
            className="w-full"
          />
        </ExpandTrigger>
      ))}
    </ListCard>
  );
}

const SESSIONS_KEY = "/api/sessions";

export default function SessionsPage() {
  useScrollRestoration();
  const { data: sessionsData, isLoading: loading } = useTrackedSWR<{
    sessions: SessionSummary[];
  }>(SESSIONS_KEY);
  const sessions = sessionsData?.sessions ?? [];
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const { nudge, requestOpen, reset } = useExpandNudge();

  function openSession(s: SessionSummary) {
    setSelected(s);
  }

  // Nudge the tapped row's label toward the header, then expand the panel.
  function openTrigger(s: SessionSummary, y: number) {
    requestOpen(`session-${s.id}`, y, () => openSession(s));
  }

  function back() {
    setSelected(null);
    reset(); // let the row's label ease back in
    // Refresh unpaid counts in case anything changed while in the detail.
    mutate(SESSIONS_KEY);
  }

  const outstanding = sessions.filter((s) => s.unpaid > 0);
  const settled = sessions.filter((s) => s.unpaid === 0);

  return (
    <>
      {/* The list stays mounted so its scroll is preserved and the shared
          surface keeps a stable anchor to morph from/to. */}
      <div className="space-y-4">
        <PageHeader title="Sessions" />

        {loading ? (
          <CenteredSpinner />
        ) : (
          <Tabs defaultValue="outstanding">
            <TabsList variant="pill" className="w-full">
              <TabsTrigger value="outstanding">
                Outstanding ({outstanding.length})
              </TabsTrigger>
              <TabsTrigger value="settled">Settled ({settled.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="outstanding" className="mt-3">
              <SessionList
                sessions={outstanding}
                nudge={nudge}
                onOpen={openTrigger}
              />
            </TabsContent>
            <TabsContent value="settled" className="mt-3">
              <SessionList sessions={settled} nudge={nudge} onOpen={openTrigger} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <ExpandOverlay
        open={!!selected}
        layoutId={`session-${selected?.id}`}
        onDismiss={back}
      >
        {selected && <SessionDetail session={selected} onBack={back} />}
      </ExpandOverlay>
    </>
  );
}
