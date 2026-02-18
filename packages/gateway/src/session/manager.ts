import { nanoid } from "nanoid";
import type { Session, MessageRow, SessionSummary } from "./types.js";
import { FALLBACK_MODEL } from "./types.js";
import { getDefaultModel } from "@tek/core";
import {
	saveSession,
	getSession,
	updateLastActive,
	updateSessionModel,
	listSessions,
	saveMessage,
	getMessages,
} from "./store.js";

/**
 * SessionManager handles session lifecycle: creation, retrieval,
 * message persistence, and listing.
 */
export class SessionManager {
	/**
	 * Create a new session with a transparent key format: agent:{agentId}:{id}
	 */
	create(agentId: string = "default", model?: string): Session {
		const id = nanoid();
		const now = new Date().toISOString();
		const session: Session = {
			id,
			sessionKey: `agent:${agentId}:${id}`,
			agentId,
			model: model ?? getDefaultModel(),
			createdAt: now,
			lastActiveAt: now,
		};
		saveSession(session);
		return session;
	}

	/**
	 * Get a session by ID and update its lastActiveAt timestamp.
	 */
	get(sessionId: string): Session | undefined {
		const session = getSession(sessionId);
		if (session) {
			updateLastActive(sessionId);
		}
		return session;
	}

	/**
	 * Update the model for a session (mid-conversation model switching).
	 */
	updateModel(sessionId: string, model: string): void {
		updateSessionModel(sessionId, model);
	}

	/**
	 * Add a message to a session.
	 */
	addMessage(
		sessionId: string,
		role: string,
		content: string,
		tokenCount?: number,
	): void {
		saveMessage(sessionId, role, content, tokenCount);
	}

	/**
	 * Get messages for a session.
	 */
	getMessages(sessionId: string, limit?: number): MessageRow[] {
		return getMessages(sessionId, limit);
	}

	/**
	 * List all sessions with message counts.
	 */
	list(): SessionSummary[] {
		return listSessions();
	}
}

/** Singleton session manager instance. */
export const sessionManager = new SessionManager();
