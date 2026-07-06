import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attendances, players, sessions } from "@/db/schema";

export async function GET() {
  // All attendance rows joined to player + session. Low volume, so aggregate in JS.
  const rows = await db
    .select({
      attId: attendances.id,
      playerId: attendances.playerId,
      playerName: players.name,
      playerActive: players.active,
      sessionId: attendances.sessionId,
      date: sessions.date,
      rate: sessions.rate,
      amountDue: attendances.amountDue,
      paid: attendances.paid,
    })
    .from(attendances)
    .innerJoin(players, eq(attendances.playerId, players.id))
    .innerJoin(sessions, eq(attendances.sessionId, sessions.id));

  let totalOutstanding = 0;
  let totalCollected = 0;

  const byPlayer = new Map<
    number,
    { playerId: number; name: string; owed: number; unpaid: number; sessions: number }
  >();
  const bySession = new Map<
    number,
    { sessionId: number; date: Date; rate: number; total: number; paid: number }
  >();

  for (const r of rows) {
    // Collected counts everyone (money actually received, incl. inactive
    // players). Outstanding / who-owes only count active players.
    if (r.paid) {
      totalCollected += r.amountDue;
    } else if (r.playerActive) {
      totalOutstanding += r.amountDue;
    }

    if (r.playerActive) {
      const p = byPlayer.get(r.playerId) ?? {
        playerId: r.playerId,
        name: r.playerName,
        owed: 0,
        unpaid: 0,
        sessions: 0,
      };
      p.sessions += 1;
      if (!r.paid) {
        p.owed += r.amountDue;
        p.unpaid += 1;
      }
      byPlayer.set(r.playerId, p);
    }

    const s = bySession.get(r.sessionId) ?? {
      sessionId: r.sessionId,
      date: r.date,
      rate: r.rate,
      total: 0,
      paid: 0,
    };
    s.total += 1;
    if (r.paid) s.paid += 1;
    bySession.set(r.sessionId, s);
  }

  const playerBalances = [...byPlayer.values()].sort(
    (a, b) => b.owed - a.owed || a.name.localeCompare(b.name),
  );
  const sessionSummaries = [...bySession.values()].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  return NextResponse.json({
    totalOutstanding,
    totalCollected,
    playerBalances,
    sessions: sessionSummaries,
  });
}
