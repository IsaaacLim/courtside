import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendances, sessions } from "@/db/schema";

// PATCH /api/sessions/:id  body: { date, rate, playerIds }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  let body: { date?: unknown; rate?: unknown; playerIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

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

  const [existing] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id));
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await db.update(sessions).set({ date: parsed, rate }).where(eq(sessions.id, id));

  // Reconcile the roster against the existing attendances.
  const current = await db
    .select({ playerId: attendances.playerId })
    .from(attendances)
    .where(eq(attendances.sessionId, id));
  const currentIds = new Set(current.map((r) => r.playerId));
  const nextIds = new Set(playerIds);

  const toRemove = [...currentIds].filter((pid) => !nextIds.has(pid));
  const toAdd = playerIds.filter((pid) => !currentIds.has(pid));

  if (toRemove.length) {
    await db
      .delete(attendances)
      .where(
        and(
          eq(attendances.sessionId, id),
          inArray(attendances.playerId, toRemove),
        ),
      );
  }
  if (toAdd.length) {
    await db
      .insert(attendances)
      .values(toAdd.map((playerId) => ({ sessionId: id, playerId, amountDue: rate })));
  }

  // Rate applies to everyone: rewrite amountDue for all remaining attendances
  // (paid status is left untouched).
  await db
    .update(attendances)
    .set({ amountDue: rate })
    .where(eq(attendances.sessionId, id));

  return NextResponse.json({ ok: true });
}

// DELETE /api/sessions/:id — remove a session and its attendance rows.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  // Remove child attendances first — don't rely on FK cascade being enabled.
  await db.delete(attendances).where(eq(attendances.sessionId, id));

  const [row] = await db
    .delete(sessions)
    .where(eq(sessions.id, id))
    .returning();
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
