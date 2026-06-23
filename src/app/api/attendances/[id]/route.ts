import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attendances } from "@/db/schema";

// PATCH /api/attendances/:id  body: { paid: boolean, method?: string|null }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  let body: { paid?: unknown; method?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (typeof body.paid !== "boolean") {
    return NextResponse.json({ error: "paid required" }, { status: 400 });
  }

  const method =
    body.paid && typeof body.method === "string" && body.method
      ? body.method
      : null;

  const [row] = await db
    .update(attendances)
    .set({
      paid: body.paid,
      paidAt: body.paid ? new Date() : null,
      method,
    })
    .where(eq(attendances.id, id))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ attendance: row });
}
