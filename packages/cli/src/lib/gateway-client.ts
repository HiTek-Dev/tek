import { nanoid } from "nanoid";
import type { ClientMessage } from "@agentspace/gateway";

// ── ChatMessage discriminated union ────────────────────────────────────

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

// ── Message factory functions ──────────────────────────────────────────

/** Create a chat.send message for the gateway WebSocket protocol. */
export function createChatSendMessage(
	content: string,
	opts?: { sessionId?: string; model?: string },
): ClientMessage {
	return {
		type: "chat.send",
		id: nanoid(),
		content,
		...opts,
	};
}

/** Create a context.inspect message for the gateway WebSocket protocol. */
export function createContextInspectMessage(
	sessionId: string,
): ClientMessage {
	return {
		type: "context.inspect",
		id: nanoid(),
		sessionId,
	};
}

/** Create a usage.query message for the gateway WebSocket protocol. */
export function createUsageQueryMessage(sessionId?: string): ClientMessage {
	return {
		type: "usage.query",
		id: nanoid(),
		sessionId,
	};
}

/** Create a session.list message for the gateway WebSocket protocol. */
export function createSessionListMessage(): ClientMessage {
	return {
		type: "session.list",
		id: nanoid(),
	};
}
