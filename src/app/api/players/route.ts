import { NextResponse } from "next/server";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendances, players } from "@/db/schema";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const includeInactive = url.searchParams.get("includeInactive") === "1";

  const conditions = [];
  if (!includeInactive) conditions.push(eq(players.active, true));
  if (q) conditions.push(like(players.name, `%${q}%`));

  const rows = await db
    .select()
    .from(players)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(players.name);

  // Outstanding balance (sum of unpaid dues) per player.
  const owedRows = await db
    .select({
      playerId: attendances.playerId,
      owed: sql<number>`sum(${attendances.amountDue})`,
    })
    .from(attendances)
    .where(eq(attendances.paid, false))
    .groupBy(attendances.playerId);
  const owedByPlayer = new Map(
    owedRows.map((r) => [r.playerId, Number(r.owed) || 0]),
  );

  const withOwed = rows.map((p) => ({
    ...p,
    owed: owedByPlayer.get(p.id) ?? 0,
  }));

  return NextResponse.json({ players: withOwed });
}

export async function POST(req: Request) {
  let name = "";
  try {
    const body = await req.json();
    name = typeof body?.name === "string" ? body.name.trim() : "";
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const [row] = await db.insert(players).values({ name }).returning();
  return NextResponse.json({ player: row }, { status: 201 });
}
