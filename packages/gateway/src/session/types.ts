export interface Session {
	id: string;
	sessionKey: string; // 'agent:{agentId}:{id}'
	agentId: string;
	model: string;
	createdAt: string;
	lastActiveAt: string;
}

export interface SessionSummary {
	sessionId: string;
	sessionKey: string;
	model: string;
	createdAt: string;
	messageCount: number;
}

export interface MessageRow {
	id: number;
	sessionId: string;
	role: string;
	content: string;
	createdAt: string;
	tokenCount: number | null;
}

/** Absolute fallback — used only when no providers or config exist */
export const FALLBACK_MODEL = "ollama:llama3";
