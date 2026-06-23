import { NextResponse } from "next/server";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { attendances, players } from "@/db/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  let body: { name?: unknown; active?: unknown; mergeIntoId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Merge this player into another, then delete this one.
  if (body.mergeIntoId !== undefined) {
    const target = Number(body.mergeIntoId);
    if (!Number.isInteger(target) || target === id) {
      return NextResponse.json({ error: "bad mergeIntoId" }, { status: 400 });
    }

    // Sessions the target already attends — don't create duplicate rows for those.
    const targetRows = await db
      .select({ sessionId: attendances.sessionId })
      .from(attendances)
      .where(eq(attendances.playerId, target));
    const targetSessions = targetRows.map((r) => r.sessionId);

    // Move this player's attendances to the target, except where the target
    // already has a row for the same session (the unique index would reject it).
    if (targetSessions.length) {
      await db
        .update(attendances)
        .set({ playerId: target })
        .where(
          and(
            eq(attendances.playerId, id),
            notInArray(attendances.sessionId, targetSessions),
          ),
        );
      // Drop the now-redundant duplicates still pointing at this player.
      await db
        .delete(attendances)
        .where(
          and(
            eq(attendances.playerId, id),
            inArray(attendances.sessionId, targetSessions),
          ),
        );
    } else {
      await db
        .update(attendances)
        .set({ playerId: target })
        .where(eq(attendances.playerId, id));
    }

    await db.delete(players).where(eq(players.id, id));
    return NextResponse.json({ ok: true, mergedInto: target });
  }

  const updates: Partial<typeof players.$inferInsert> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (typeof body.active === "boolean") {
    updates.active = body.active;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const [row] = await db
    .update(players)
    .set(updates)
    .where(eq(players.id, id))
    .returning();
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ player: row });
}
