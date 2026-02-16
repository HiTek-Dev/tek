import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const threads = sqliteTable("threads", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	systemPrompt: text("system_prompt"),
	archived: integer("archived", { mode: "boolean" }).default(false),
	createdAt: text("created_at").notNull(),
	lastActiveAt: text("last_active_at").notNull(),
});
