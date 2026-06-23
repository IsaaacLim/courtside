import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendances, sessions } from "@/db/schema";

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
