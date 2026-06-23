import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Players in the roster. Guests / "+1"s are first-class players too.
 * `aliases` is reserved for a future AI paste-and-match phase; unused for now.
 */
export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // JSON-encoded string[]; reserved for future fuzzy matching.
  aliases: text("aliases", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * One game session (a week). `rate` is the per-player charge in integer cents.
 */
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // The game date, stored as a timestamp (midnight of that day).
  date: integer("date", { mode: "timestamp" }).notNull(),
  rate: integer("rate").notNull(), // cents
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * A player's attendance at a session, and the payment state for it.
 * `amountDue` is snapshotted from the session rate at creation time, so editing
 * a session's rate later never rewrites historical balances.
 */
export const attendances = sqliteTable(
  "attendances",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    amountDue: integer("amount_due").notNull(), // cents, snapshot of session rate
    paid: integer("paid", { mode: "boolean" }).notNull().default(false),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    method: text("method"), // 'beem' | 'payid' | other | null
    note: text("note"),
  },
  (t) => [
    uniqueIndex("attendances_session_player_unq").on(t.sessionId, t.playerId),
    index("attendances_player_idx").on(t.playerId),
    index("attendances_paid_idx").on(t.paid),
  ],
);

export type Player = typeof players.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Attendance = typeof attendances.$inferSelect;
