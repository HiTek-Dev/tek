import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const globalPrompts = sqliteTable("global_prompts", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	content: text("content").notNull(),
	isActive: integer("is_active", { mode: "boolean" }).default(true),
	priority: integer("priority").default(0),
	createdAt: text("created_at").notNull(),
});
