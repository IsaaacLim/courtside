import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendances, sessions } from "@/db/schema";

// GET /api/attendances?playerId=123[&paid=0|1]
export async function GET(req: Request) {
  const url = new URL(req.url);
  const playerId = Number(url.searchParams.get("playerId"));
  if (!Number.isInteger(playerId)) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  const paidParam = url.searchParams.get("paid");
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
