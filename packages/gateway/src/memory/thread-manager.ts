import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import { getDb, threads, globalPrompts } from "@tek/db";

export interface ThreadRow {
	id: string;
	title: string;
	systemPrompt: string | null;
	archived: boolean | null;
	createdAt: string;
	lastActiveAt: string;
}

export interface GlobalPromptRow {
	id: number;
	name: string;
	content: string;
	isActive: boolean | null;
	priority: number | null;
	createdAt: string;
}

/**
 * Manages conversation threads and global system prompts.
 * Provides CRUD operations for threads and prompt assembly
 * that merges global prompts (by priority) with per-thread prompts.
 */
export class ThreadManager {
	// ── Thread Operations ──────────────────────────────────────────────

	createThread(title: string, systemPrompt?: string): ThreadRow {
		const db = getDb();
		const now = new Date().toISOString();
		const id = nanoid();

		db.insert(threads)
			.values({
				id,
				title,
				systemPrompt: systemPrompt ?? null,
				archived: false,
				createdAt: now,
				lastActiveAt: now,
			})
			.run();

		return {
			id,
			title,
			systemPrompt: systemPrompt ?? null,
			archived: false,
			createdAt: now,
			lastActiveAt: now,
		};
	}

	getThread(id: string): ThreadRow | undefined {
		const db = getDb();
		return db.select().from(threads).where(eq(threads.id, id)).get() as
			| ThreadRow
			| undefined;
	}

	listThreads(includeArchived?: boolean): ThreadRow[] {
		const db = getDb();
		if (includeArchived) {
			return db
				.select()
				.from(threads)
				.orderBy(desc(threads.lastActiveAt))
				.all() as ThreadRow[];
		}
		return db
			.select()
			.from(threads)
			.where(eq(threads.archived, false))
			.orderBy(desc(threads.lastActiveAt))
			.all() as ThreadRow[];
	}

	updateThread(
		id: string,
		updates: { title?: string; systemPrompt?: string; archived?: boolean },
	): void {
		const db = getDb();
		const setValues: Record<string, unknown> = {};
		if (updates.title !== undefined) setValues.title = updates.title;
		if (updates.systemPrompt !== undefined)
			setValues.systemPrompt = updates.systemPrompt;
		if (updates.archived !== undefined) setValues.archived = updates.archived;
		setValues.lastActiveAt = new Date().toISOString();

		db.update(threads).set(setValues).where(eq(threads.id, id)).run();
	}

	// ── System Prompt Assembly ─────────────────────────────────────────

	/**
	 * Build the complete system prompt by merging active global prompts
	 * (ordered by priority descending) with the thread-specific prompt.
	 * Returns raw system prompt text -- soul/memory are added by the assembler.
	 */
	buildSystemPrompt(threadId?: string): string {
		const db = getDb();
		const parts: string[] = [];

		// Load active global prompts ordered by priority (highest first)
		const activePrompts = db
			.select()
			.from(globalPrompts)
			.where(eq(globalPrompts.isActive, true))
			.orderBy(desc(globalPrompts.priority))
			.all();

		for (const prompt of activePrompts) {
			parts.push(prompt.content);
		}

		// Append thread-specific system prompt if present
		if (threadId) {
			const thread = this.getThread(threadId);
			if (thread?.systemPrompt) {
				parts.push(thread.systemPrompt);
			}
		}

		return parts.join("\n\n");
	}

	// ── Global Prompt Operations ───────────────────────────────────────

	addGlobalPrompt(
		name: string,
		content: string,
		priority?: number,
	): { id: number } {
		const db = getDb();
		const result = db
			.insert(globalPrompts)
			.values({
				name,
				content,
				isActive: true,
				priority: priority ?? 0,
				createdAt: new Date().toISOString(),
			})
			.returning({ id: globalPrompts.id })
			.get();

		return { id: result.id };
	}

	listGlobalPrompts(): GlobalPromptRow[] {
		const db = getDb();
		return db
			.select()
			.from(globalPrompts)
			.orderBy(desc(globalPrompts.priority))
			.all() as GlobalPromptRow[];
	}

	updateGlobalPrompt(
		id: number,
		updates: { content?: string; isActive?: boolean; priority?: number },
	): void {
		const db = getDb();
		const setValues: Record<string, unknown> = {};
		if (updates.content !== undefined) setValues.content = updates.content;
		if (updates.isActive !== undefined) setValues.isActive = updates.isActive;
		if (updates.priority !== undefined) setValues.priority = updates.priority;

		db.update(globalPrompts)
			.set(setValues)
			.where(eq(globalPrompts.id, id))
			.run();
	}

	removeGlobalPrompt(id: number): void {
		const db = getDb();
		db.delete(globalPrompts).where(eq(globalPrompts.id, id)).run();
	}
}
