import { NextResponse } from "next/server";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";

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

  return NextResponse.json({ players: rows });
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
