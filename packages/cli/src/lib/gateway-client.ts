import { nanoid } from "nanoid";
import type { ClientMessage } from "@tek/gateway";

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

/** Create a tool.approval.response message for the gateway WebSocket protocol. */
export function createToolApprovalResponse(
	toolCallId: string,
	approved: boolean,
	sessionApprove?: boolean,
): ClientMessage {
	return {
		type: "tool.approval.response",
		id: nanoid(),
		toolCallId,
		approved,
		...(sessionApprove !== undefined ? { sessionApprove } : {}),
	};
}

/** Create a preflight.approval message for the gateway WebSocket protocol. */
export function createPreflightApprovalResponse(
	requestId: string,
	approved: boolean,
	editedSteps?: Array<{
		description: string;
		toolName?: string;
		skip?: boolean;
	}>,
): ClientMessage {
	return {
		type: "preflight.approval",
		id: nanoid(),
		requestId,
		approved,
		...(editedSteps ? { editedSteps } : {}),
	};
}
