import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";

export async function GET() {
  const [last] = await db
    .select({ rate: sessions.rate })
    .from(sessions)
    .orderBy(desc(sessions.date), desc(sessions.id))
    .limit(1);

  return NextResponse.json({ rate: last?.rate ?? null });
}
