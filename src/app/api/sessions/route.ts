import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attendances, sessions } from "@/db/schema";

// GET /api/sessions — session summaries, newest first.
export async function GET() {
  // Low volume: join attendances→sessions and tally per session in JS, like
  // /api/overview does.
  const rows = await db
    .select({
      sessionId: attendances.sessionId,
      date: sessions.date,
      rate: sessions.rate,
      paid: attendances.paid,
    })
    .from(attendances)
    .innerJoin(sessions, eq(attendances.sessionId, sessions.id));

  const bySession = new Map<
    number,
    { id: number; date: Date; rate: number; total: number; paid: number }
  >();
  for (const r of rows) {
    const s = bySession.get(r.sessionId) ?? {
      id: r.sessionId,
      date: r.date,
      rate: r.rate,
      total: 0,
      paid: 0,
    };
    s.total += 1;
    if (r.paid) s.paid += 1;
    bySession.set(r.sessionId, s);
  }

  const list = [...bySession.values()]
    .map((s) => ({ ...s, unpaid: s.total - s.paid }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return NextResponse.json({ sessions: list });
}

export async function POST(req: Request) {
  let body: { date?: unknown; rate?: unknown; playerIds?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // date: "YYYY-MM-DD" -> timestamp at local midnight.
  const dateStr = typeof body.date === "string" ? body.date : "";
  const parsed = dateStr ? new Date(`${dateStr}T00:00:00`) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }

  const rate = Number(body.rate);
  if (!Number.isInteger(rate) || rate < 0) {
    return NextResponse.json({ error: "invalid rate" }, { status: 400 });
  }

  const playerIds = Array.isArray(body.playerIds)
    ? Array.from(
        new Set(body.playerIds.map((x) => Number(x)).filter(Number.isInteger)),
      )
    : [];
  if (playerIds.length === 0) {
    return NextResponse.json(
      { error: "select at least one player" },
      { status: 400 },
    );
  }

  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  const [session] = await db
    .insert(sessions)
    .values({ date: parsed, rate, note })
    .returning();

  // amountDue is snapshotted from the session rate so later rate edits don't
  // rewrite historical balances.
  await db.insert(attendances).values(
    playerIds.map((playerId) => ({
      sessionId: session.id,
      playerId,
      amountDue: rate,
    })),
  );

  return NextResponse.json({ session }, { status: 201 });
}
