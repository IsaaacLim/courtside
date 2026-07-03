import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attendances, sessions } from "@/db/schema";

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
