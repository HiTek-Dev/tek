// ── ChatMessage types for desktop UI ────────────────────────────────────

type ChatMessageBase = {
	id: string;
	timestamp: string;
};

export type TextMessage = ChatMessageBase & {
	type: "text";
	role: "user" | "assistant" | "system";
	content: string;
};

export type ToolCallMessage = ChatMessageBase & {
	type: "tool_call";
	toolName: string;
	input: string;
	output?: string;
	status: "pending" | "complete" | "error";
};

export type BashCommandMessage = ChatMessageBase & {
	type: "bash_command";
	command: string;
	output?: string;
	exitCode?: number;
};

export type ReasoningMessage = ChatMessageBase & {
	type: "reasoning";
	content: string;
};

export type ChatMessage =
	| TextMessage
	| ToolCallMessage
	| BashCommandMessage
	| ReasoningMessage;

// ── Minimal types for gateway protocol messages ─────────────────────────
// Defined locally to avoid heavy imports from @tek/gateway in the browser context.

export type ClientMessage = {
	type: string;
	id: string;
	[key: string]: unknown;
};

// ── Message factory functions ───────────────────────────────────────────

/** Create a chat.send message for the gateway WebSocket protocol. */
export function createChatSendMessage(
	content: string,
	opts?: { sessionId?: string; model?: string },
): ClientMessage {
	return {
		type: "chat.send",
		id: crypto.randomUUID(),
		content,
		...opts,
	};
}

/** Create a session.list message for the gateway WebSocket protocol. */
export function createSessionListMessage(): ClientMessage {
	return {
		type: "session.list",
		id: crypto.randomUUID(),
	};
}

/** Create a context.inspect message for the gateway WebSocket protocol. */
export function createContextInspectMessage(sessionId: string): ClientMessage {
	return {
		type: "context.inspect",
		id: crypto.randomUUID(),
		sessionId,
	};
}

/** Create a usage.query message for the gateway WebSocket protocol. */
export function createUsageQueryMessage(sessionId?: string): ClientMessage {
	return {
		type: "usage.query",
		id: crypto.randomUUID(),
		...(sessionId ? { sessionId } : {}),
	};
}

/** Create a tool.approval.response message for the gateway WebSocket protocol. */
export function createToolApprovalResponse(
	toolCallId: string,
	approved: boolean,
	sessionApprove?: boolean,
): ClientMessage {
	return {
		type: "tool.approval.response",
		id: crypto.randomUUID(),
		toolCallId,
		approved,
		...(sessionApprove !== undefined ? { sessionApprove } : {}),
	};
}
