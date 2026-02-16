import { z } from "zod";

// ── Client Messages (inbound) ──────────────────────────────────────────

const ChatSendSchema = z.object({
	type: z.literal("chat.send"),
	id: z.string(),
	sessionId: z.string().optional(),
	content: z.string(),
	model: z.string().optional(),
});

const ContextInspectSchema = z.object({
	type: z.literal("context.inspect"),
	id: z.string(),
	sessionId: z.string(),
});

const UsageQuerySchema = z.object({
	type: z.literal("usage.query"),
	id: z.string(),
	sessionId: z.string().optional(),
});

const SessionListSchema = z.object({
	type: z.literal("session.list"),
	id: z.string(),
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
	ChatSendSchema,
	ContextInspectSchema,
	UsageQuerySchema,
	SessionListSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ChatSend = z.infer<typeof ChatSendSchema>;
export type ContextInspect = z.infer<typeof ContextInspectSchema>;
export type UsageQuery = z.infer<typeof UsageQuerySchema>;
export type SessionList = z.infer<typeof SessionListSchema>;

// ── Server Messages (outbound) ─────────────────────────────────────────

const ChatStreamStartSchema = z.object({
	type: z.literal("chat.stream.start"),
	requestId: z.string(),
	sessionId: z.string(),
	model: z.string(),
});

const ChatStreamDeltaSchema = z.object({
	type: z.literal("chat.stream.delta"),
	requestId: z.string(),
	delta: z.string(),
});

const ChatStreamEndSchema = z.object({
	type: z.literal("chat.stream.end"),
	requestId: z.string(),
	usage: z.object({
		inputTokens: z.number(),
		outputTokens: z.number(),
		totalTokens: z.number(),
	}),
	cost: z.object({
		inputCost: z.number(),
		outputCost: z.number(),
		totalCost: z.number(),
	}),
});

const ContextInspectionSchema = z.object({
	type: z.literal("context.inspection"),
	requestId: z.string(),
	sections: z.array(
		z.object({
			name: z.string(),
			content: z.string(),
			byteCount: z.number(),
			tokenEstimate: z.number(),
			costEstimate: z.number(),
		}),
	),
	totals: z.object({
		byteCount: z.number(),
		tokenEstimate: z.number(),
		costEstimate: z.number(),
	}),
});

const UsageReportSchema = z.object({
	type: z.literal("usage.report"),
	requestId: z.string(),
	perModel: z.record(
		z.string(),
		z.object({
			inputTokens: z.number(),
			outputTokens: z.number(),
			totalTokens: z.number(),
			totalCost: z.number(),
			requestCount: z.number(),
		}),
	),
	grandTotal: z.object({
		totalCost: z.number(),
		totalTokens: z.number(),
		requestCount: z.number(),
	}),
});

const ErrorSchema = z.object({
	type: z.literal("error"),
	requestId: z.string().optional(),
	code: z.string(),
	message: z.string(),
});

const SessionCreatedSchema = z.object({
	type: z.literal("session.created"),
	sessionId: z.string(),
	sessionKey: z.string(),
});

const SessionListResponseSchema = z.object({
	type: z.literal("session.list"),
	requestId: z.string(),
	sessions: z.array(
		z.object({
			sessionId: z.string(),
			sessionKey: z.string(),
			model: z.string(),
			createdAt: z.string(),
			messageCount: z.number(),
		}),
	),
});

export const ServerMessageSchema = z.discriminatedUnion("type", [
	ChatStreamStartSchema,
	ChatStreamDeltaSchema,
	ChatStreamEndSchema,
	ContextInspectionSchema,
	UsageReportSchema,
	ErrorSchema,
	SessionCreatedSchema,
	SessionListResponseSchema,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ChatStreamStart = z.infer<typeof ChatStreamStartSchema>;
export type ChatStreamDelta = z.infer<typeof ChatStreamDeltaSchema>;
export type ChatStreamEnd = z.infer<typeof ChatStreamEndSchema>;
export type ContextInspection = z.infer<typeof ContextInspectionSchema>;
export type UsageReport = z.infer<typeof UsageReportSchema>;
export type ErrorMessage = z.infer<typeof ErrorSchema>;
export type SessionCreated = z.infer<typeof SessionCreatedSchema>;
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;
