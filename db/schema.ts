import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type Companion = { name: string; dietary: string };

export const responses = sqliteTable("responses", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  updateTokenHash: text("update_token_hash").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().default(""),
  attendance: text("attendance", { enum: ["yes", "no"] }).notNull(),
  guestCount: integer("guest_count").notNull(),
  companions: text("companions", { mode: "json" })
    .$type<Companion[]>()
    .notNull(),
  dietary: text("dietary").notNull().default(""),
  message: text("message").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
