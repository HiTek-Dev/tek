import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import { getDefaultModel } from "@tek/core";
import type { ServerMessage } from "@tek/gateway";
import type { ChatMessage, TextMessage, ToolCallMessage, ReasoningMessage, SourceMessage } from "../lib/gateway-client.js";

export interface PendingApproval {
	toolCallId: string;
	toolName: string;
	args: unknown;
}

export interface TodoItem {
	id: string;
	content: string;
	status: "pending" | "in_progress" | "completed";
	activeForm?: string;
}

export interface PendingPreflight {
	requestId: string;
	steps: Array<{
		description: string;
		toolName?: string;
		risk: "low" | "medium" | "high";
		needsApproval: boolean;
	}>;
	estimatedCost: {
		inputTokens: number;
		outputTokens: number;
		estimatedUSD: number;
	};
	requiredPermissions: string[];
	warnings: string[];
}

export interface UseChatOptions {
	initialModel?: string;
	resumeSessionId?: string;
}

export interface UseChatState {
	messages: ChatMessage[];
	streamingText: string;
	isStreaming: boolean;
	sessionId: string | null;
	model: string;
	connected: boolean;
	usage: {
		totalTokens: number;
		totalCost: number;
	};
	pendingApproval: PendingApproval | null;
	pendingPreflight: PendingPreflight | null;
}

const DEFAULT_MODEL = getDefaultModel() ?? "ollama:llama3";

/**
 * React hook for managing chat state, including message history,
 * streaming text accumulation, and usage tracking.
 */
export function useChat(opts: UseChatOptions = {}) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [streamingText, setStreamingText] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [sessionId, setSessionId] = useState<string | null>(
		opts.resumeSessionId ?? null,
	);
	const [model, setModel] = useState(opts.initialModel ?? DEFAULT_MODEL);
	const [connected, setConnected] = useState(false);
	const [usage, setUsage] = useState({ totalTokens: 0, totalCost: 0 });
	const [pendingApproval, setPendingApproval] =
		useState<PendingApproval | null>(null);
	const [pendingPreflight, setPendingPreflight] =
		useState<PendingPreflight | null>(null);
	const [streamingReasoning, setStreamingReasoning] = useState("");
	const [pendingSources, setPendingSources] = useState<
		Array<{ url: string; title?: string }>
	>([]);
	const [todos, setTodos] = useState<TodoItem[]>([]);
	const [toolCalls, setToolCalls] = useState<
		Array<{
			toolCallId: string;
			toolName: string;
			args: unknown;
			result?: unknown;
			status: "pending" | "complete" | "error";
		}>
	>([]);

	const addMessage = useCallback((msg: ChatMessage) => {
		setMessages((prev) => [...prev, msg]);
	}, []);

	const clearMessages = useCallback(() => {
		setMessages([]);
	}, []);

	const handleServerMessage = useCallback((msg: ServerMessage) => {
		switch (msg.type) {
			case "session.created":
				setSessionId(msg.sessionId);
				break;

			case "chat.stream.start":
				setStreamingText("");
				setStreamingReasoning("");
				setPendingSources([]);
				setTodos([]);
				setIsStreaming(true);
				setModel(msg.model);
				break;

			case "chat.stream.delta":
				setStreamingText((prev) => prev + msg.delta);
				break;

			case "chat.stream.reasoning":
				setStreamingReasoning((prev) => prev + msg.delta);
				break;

			case "chat.stream.source":
				setPendingSources((prev) => [...prev, msg.source]);
				break;

			case "chat.stream.end":
				// Promote reasoning to a completed message (before assistant text)
				setStreamingReasoning((currentReasoning) => {
					if (currentReasoning) {
						const reasoningMsg: ReasoningMessage = {
							id: nanoid(),
							type: "reasoning",
							content: currentReasoning,
							timestamp: new Date().toISOString(),
						};
						setMessages((prev) => [...prev, reasoningMsg]);
					}
					return "";
				});
				// Promote accumulated streaming text to a completed message
				setStreamingText((current) => {
					if (current) {
						const assistantMsg: TextMessage = {
							id: nanoid(),
							type: "text",
							role: "assistant",
							content: current,
							timestamp: new Date().toISOString(),
						};
						setMessages((prev) => [...prev, assistantMsg]);
					}
					return "";
				});
				// Promote sources to a completed message (after assistant text)
				setPendingSources((currentSources) => {
					if (currentSources.length > 0) {
						const sourceMsg: SourceMessage = {
							id: nanoid(),
							type: "sources",
							sources: [...currentSources],
							timestamp: new Date().toISOString(),
						};
						setMessages((prev) => [...prev, sourceMsg]);
					}
					return [];
				});
				setIsStreaming(false);
				// Update usage totals
				setUsage((prev) => ({
					totalTokens: prev.totalTokens + msg.usage.totalTokens,
					totalCost: prev.totalCost + msg.cost.totalCost,
				}));
				break;

			case "tool.call": {
				const toolCallId = msg.toolCallId;
				const toolName = msg.toolName;
				const args = msg.args;

				// Track the tool call
				setToolCalls((prev) => [
					...prev,
					{ toolCallId, toolName, args, status: "pending" },
				]);

				// Add a ToolCallMessage to the message list
				const toolMsg: ToolCallMessage = {
					id: toolCallId,
					type: "tool_call",
					toolName,
					input: typeof args === "string" ? args : JSON.stringify(args, null, 2),
					status: "pending",
					timestamp: new Date().toISOString(),
				};
				setMessages((prev) => [...prev, toolMsg]);
				break;
			}

			case "tool.result": {
				const tcId = msg.toolCallId;
				const resultStr =
					typeof msg.result === "string"
						? msg.result
						: JSON.stringify(msg.result, null, 2);

				// Update tool call tracking
				setToolCalls((prev) =>
					prev.map((tc) =>
						tc.toolCallId === tcId
							? { ...tc, result: msg.result, status: "complete" as const }
							: tc,
					),
				);

				// Update the ToolCallMessage in messages
				setMessages((prev) =>
					prev.map((m) =>
						m.type === "tool_call" && m.id === tcId
							? { ...m, output: resultStr, status: "complete" as const }
							: m,
					),
				);
				break;
			}

			case "tool.approval.request": {
				setPendingApproval({
					toolCallId: msg.toolCallId,
					toolName: msg.toolName,
					args: msg.args,
				});
				break;
			}

			case "preflight.checklist": {
				setPendingPreflight({
					requestId: msg.requestId,
					steps: msg.steps,
					estimatedCost: msg.estimatedCost,
					requiredPermissions: msg.requiredPermissions,
					warnings: msg.warnings,
				});
				break;
			}

			case "todo.update": {
				setTodos(msg.todos);
				break;
			}

			case "error":
				setMessages((prev) => [
					...prev,
					{
						id: nanoid(),
						type: "text" as const,
						role: "system" as const,
						content: `Error: ${msg.message}`,
						timestamp: new Date().toISOString(),
					},
				]);
				setStreamingText("");
				setStreamingReasoning("");
				setPendingSources([]);
				setTodos([]);
				setIsStreaming(false);
				break;

			case "session.list": {
				const sessions = msg.sessions;
				const lines = sessions.map(
					(s) =>
						`  ${s.sessionId.slice(0, 8)}  ${s.model}  ${s.messageCount} msgs  ${s.createdAt}`,
				);
				const content =
					sessions.length > 0
						? `Sessions:\n${lines.join("\n")}`
						: "No sessions found.";
				setMessages((prev) => [
					...prev,
					{
						id: nanoid(),
						type: "text" as const,
						role: "system" as const,
						content,
						timestamp: new Date().toISOString(),
					},
				]);
				break;
			}

			case "context.inspection": {
				const lines = msg.sections.map(
					(s) =>
						`  ${s.name}: ${s.byteCount} bytes, ~${s.tokenEstimate} tokens ($${s.costEstimate.toFixed(4)})`,
				);
				const content = `Context:\n${lines.join("\n")}\n  Total: ${msg.totals.byteCount} bytes, ~${msg.totals.tokenEstimate} tokens ($${msg.totals.costEstimate.toFixed(4)})`;
				setMessages((prev) => [
					...prev,
					{
						id: nanoid(),
						type: "text" as const,
						role: "system" as const,
						content,
						timestamp: new Date().toISOString(),
					},
				]);
				break;
			}

			case "usage.report": {
				const models = Object.entries(msg.perModel);
				const lines = models.map(
					([name, u]) =>
						`  ${name}: ${u.totalTokens.toLocaleString()} tokens, $${u.totalCost.toFixed(4)}, ${u.requestCount} reqs`,
				);
				const content =
					models.length > 0
						? `Usage:\n${lines.join("\n")}\n  Total: ${msg.grandTotal.totalTokens.toLocaleString()} tokens, $${msg.grandTotal.totalCost.toFixed(4)}, ${msg.grandTotal.requestCount} reqs`
						: "No usage data yet.";
				setMessages((prev) => [
					...prev,
					{
						id: nanoid(),
						type: "text" as const,
						role: "system" as const,
						content,
						timestamp: new Date().toISOString(),
					},
				]);
				break;
			}
		}
	}, []);

	const approveToolCall = useCallback(
		(approved: boolean, sessionApprove?: boolean) => {
			setPendingApproval(null);
			return { approved, sessionApprove };
		},
		[],
	);

	const approvePreflight = useCallback(
		(
			approved: boolean,
			editedSteps?: Array<{
				description: string;
				toolName?: string;
				skip?: boolean;
			}>,
		) => {
			const req = pendingPreflight;
			setPendingPreflight(null);
			return { approved, requestId: req?.requestId, editedSteps };
		},
		[pendingPreflight],
	);

	const addUserMessage = useCallback((content: string) => {
		const msg: TextMessage = {
			id: nanoid(),
			type: "text",
			role: "user",
			content,
			timestamp: new Date().toISOString(),
		};
		setMessages((prev) => [...prev, msg]);
	}, []);

	return {
		messages,
		streamingText,
		streamingReasoning,
		isStreaming,
		sessionId,
		model,
		connected,
		usage,
		pendingApproval,
		pendingPreflight,
		todos,
		toolCalls,
		handleServerMessage,
		addUserMessage,
		addMessage,
		clearMessages,
		setConnected,
		setModel,
		setSessionId,
		approveToolCall,
		approvePreflight,
	};
}
