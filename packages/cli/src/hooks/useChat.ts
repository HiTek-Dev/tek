import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import type { ServerMessage } from "@agentspace/gateway";
import type { ChatMessage, TextMessage } from "../lib/gateway-client.js";

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
}

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

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
				setIsStreaming(true);
				setModel(msg.model);
				break;

			case "chat.stream.delta":
				setStreamingText((prev) => prev + msg.delta);
				break;

			case "chat.stream.end":
				setStreamingText((current) => {
					// Promote accumulated streaming text to a completed message
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
				setIsStreaming(false);
				// Update usage totals
				setUsage((prev) => ({
					totalTokens: prev.totalTokens + msg.usage.totalTokens,
					totalCost: prev.totalCost + msg.cost.totalCost,
				}));
				break;

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
		isStreaming,
		sessionId,
		model,
		connected,
		usage,
		handleServerMessage,
		addUserMessage,
		addMessage,
		clearMessages,
		setConnected,
		setModel,
		setSessionId,
	};
}
