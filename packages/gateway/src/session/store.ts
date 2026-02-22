import { eq, desc, sql, count } from "drizzle-orm";
import { getDb, sessions, messages } from "@tek/db";
import type { Session, SessionSummary, MessageRow } from "./types.js";

/**
 * Save a new session to the database.
 */
export function saveSession(session: Session): void {
	const db = getDb();
	db.insert(sessions)
		.values({
			id: session.id,
			sessionKey: session.sessionKey,
			agentId: session.agentId,
			model: session.model,
			createdAt: session.createdAt,
			lastActiveAt: session.lastActiveAt,
		})
		.run();
}

/**
 * Get a session by ID.
 */
export function getSession(id: string): Session | undefined {
	const db = getDb();
	const row = db
		.select()
		.from(sessions)
		.where(eq(sessions.id, id))
		.get();

	if (!row) return undefined;

	return {
		id: row.id,
		sessionKey: row.sessionKey,
		agentId: row.agentId,
		model: row.model,
		createdAt: row.createdAt,
		lastActiveAt: row.lastActiveAt,
	};
}

/**
 * Update the lastActiveAt timestamp for a session.
 */
export function updateLastActive(id: string): void {
	const db = getDb();
	db.update(sessions)
		.set({ lastActiveAt: new Date().toISOString() })
		.where(eq(sessions.id, id))
		.run();
}

/**
 * Update the model for a session (for mid-conversation model switching).
 */
export function updateSessionModel(id: string, model: string): void {
	const db = getDb();
	db.update(sessions)
		.set({ model, lastActiveAt: new Date().toISOString() })
		.where(eq(sessions.id, id))
		.run();
}

/**
 * List all sessions with message counts.
 */
export function listSessions(): SessionSummary[] {
	const db = getDb();
	const rows = db
		.select({
			sessionId: sessions.id,
			sessionKey: sessions.sessionKey,
			model: sessions.model,
			createdAt: sessions.createdAt,
			messageCount: count(messages.id),
		})
		.from(sessions)
		.leftJoin(messages, eq(sessions.id, messages.sessionId))
		.groupBy(sessions.id)
		.orderBy(desc(sessions.createdAt))
		.all();

	return rows.map((r) => ({
		sessionId: r.sessionId,
		sessionKey: r.sessionKey,
		model: r.model,
		createdAt: r.createdAt,
		messageCount: r.messageCount,
	}));
}

/**
 * Save a message to the database.
 *
 * CRITICAL: Only "user" and "assistant" roles are persisted.
 * Tool results and other agent-internal messages are NOT added to session history.
 * This prevents tool-result contamination in multi-turn conversations.
 */
export function saveMessage(
	sessionId: string,
	role: string,
	content: string,
	tokenCount?: number,
): void {
	// Validate message role - only user and assistant messages are persisted
	const validRoles = ["user", "assistant"];
	if (!validRoles.includes(role)) {
		console.error(
			`[SESSION SAFETY] Rejecting message with invalid role: "${role}". Only "user" and "assistant" are allowed. This prevents tool-result contamination.`,
		);
		return;
	}

	const db = getDb();
	db.insert(messages)
		.values({
			sessionId,
			role,
			content,
			createdAt: new Date().toISOString(),
			tokenCount: tokenCount ?? null,
		})
		.run();
}

/**
 * Get messages for a session, ordered chronologically.
 */
export function getMessages(
	sessionId: string,
	limit: number = 50,
): MessageRow[] {
	const db = getDb();

	// Select latest N messages (desc), then reverse to chronological order
	const rows = db
		.select()
		.from(messages)
		.where(eq(messages.sessionId, sessionId))
		.orderBy(desc(messages.id))
		.limit(limit)
		.all();

	return rows.reverse().map((r) => ({
		id: r.id,
		sessionId: r.sessionId,
		role: r.role,
		content: r.content,
		createdAt: r.createdAt,
		tokenCount: r.tokenCount,
	}));
}
