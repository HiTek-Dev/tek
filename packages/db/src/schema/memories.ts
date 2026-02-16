import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const memories = sqliteTable("memories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	threadId: text("thread_id"),
	content: text("content").notNull(),
	memoryType: text("memory_type").notNull(),
	source: text("source"),
	createdAt: text("created_at").notNull(),
});
