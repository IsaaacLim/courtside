import { sql } from "drizzle-orm";
import { db } from "@/db";
import { appMeta } from "@/db/schema";

const ROW_ID = 1;

/** Bump the shared data version. Call after any write that changes data clients read. */
export async function bumpVersion() {
  await db
    .insert(appMeta)
    .values({ id: ROW_ID, version: 1 })
    .onConflictDoUpdate({
      target: appMeta.id,
      set: { version: sql`${appMeta.version} + 1` },
    });
}

/** Current data version. 0 if nothing has ever been written. */
export async function getVersion(): Promise<number> {
  const row = await db.query.appMeta.findFirst({ where: (t, { eq }) => eq(t.id, ROW_ID) });
  return row?.version ?? 0;
}
