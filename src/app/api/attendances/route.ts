import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendances, players, sessions } from "@/db/schema";

// GET /api/attendances?playerId=123  — a player's attendances (joined to session date)
// GET /api/attendances?sessionId=45  — a session's attendances (joined to player name)
// Optional &paid=0|1 filter on either.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const paidParam = url.searchParams.get("paid");

  // Branch: group by session (player names) — mirror of the playerId branch.
  const sessionIdRaw = url.searchParams.get("sessionId");
  if (sessionIdRaw !== null) {
    const sessionId = Number(sessionIdRaw);
    if (!Number.isInteger(sessionId)) {
      return NextResponse.json({ error: "invalid sessionId" }, { status: 400 });
    }
    const conditions = [eq(attendances.sessionId, sessionId)];
    if (paidParam === "0") conditions.push(eq(attendances.paid, false));
    if (paidParam === "1") conditions.push(eq(attendances.paid, true));

    const rows = await db
      .select({
        id: attendances.id,
        playerId: attendances.playerId,
        playerName: players.name,
        playerActive: players.active,
        amountDue: attendances.amountDue,
        paid: attendances.paid,
        paidAt: attendances.paidAt,
        method: attendances.method,
      })
      .from(attendances)
      .innerJoin(players, eq(attendances.playerId, players.id))
      .where(and(...conditions))
      .orderBy(asc(players.name));

    return NextResponse.json({ attendances: rows });
  }

  const playerId = Number(url.searchParams.get("playerId"));
  if (!Number.isInteger(playerId)) {
    return NextResponse.json(
      { error: "playerId or sessionId required" },
      { status: 400 },
    );
  }

  const conditions = [eq(attendances.playerId, playerId)];
  if (paidParam === "0") conditions.push(eq(attendances.paid, false));
  if (paidParam === "1") conditions.push(eq(attendances.paid, true));

  const rows = await db
    .select({
      id: attendances.id,
      sessionId: attendances.sessionId,
      date: sessions.date,
      amountDue: attendances.amountDue,
      paid: attendances.paid,
      paidAt: attendances.paidAt,
      method: attendances.method,
    })
    .from(attendances)
    .innerJoin(sessions, eq(attendances.sessionId, sessions.id))
    .where(and(...conditions))
    .orderBy(desc(sessions.date), desc(sessions.id));

  return NextResponse.json({ attendances: rows });
}
