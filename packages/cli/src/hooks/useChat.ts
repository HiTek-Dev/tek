import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import type { ServerMessage } from "@agentspace/gateway";
import type { ChatMessage } from "../lib/gateway-client.js";

export interface UseChatOptions {
	initialModel?: string;
	resumeSessionId?: string;
}

export interface UseChatState {
	messages: ChatMessage[];
	streamingText: string;
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
	const [sessionId, setSessionId] = useState<string | null>(
		opts.resumeSessionId ?? null,
	);
	const [model, setModel] = useState(opts.initialModel ?? DEFAULT_MODEL);
	const [connected, setConnected] = useState(false);
	const [usage, setUsage] = useState({ totalTokens: 0, totalCost: 0 });

	const handleServerMessage = useCallback((msg: ServerMessage) => {
		switch (msg.type) {
			case "session.created":
				setSessionId(msg.sessionId);
				break;

			case "chat.stream.start":
				setStreamingText("");
				setModel(msg.model);
				break;

			case "chat.stream.delta":
				setStreamingText((prev) => prev + msg.delta);
				break;

			case "chat.stream.end":
				setStreamingText((current) => {
					// Promote accumulated streaming text to a completed message
					if (current) {
						const assistantMsg: ChatMessage = {
							id: nanoid(),
							role: "assistant",
							content: current,
							timestamp: new Date().toISOString(),
						};
						setMessages((prev) => [...prev, assistantMsg]);
					}
					return "";
				});
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
						role: "system",
						content: `Error: ${msg.message}`,
						timestamp: new Date().toISOString(),
					},
				]);
				setStreamingText("");
				break;

			// Handled in Plan 03-02 (slash commands)
			case "session.list":
			case "context.inspection":
			case "usage.report":
				break;
		}
	}, []);

	const addUserMessage = useCallback((content: string) => {
		const msg: ChatMessage = {
			id: nanoid(),
			role: "user",
			content,
			timestamp: new Date().toISOString(),
		};
		setMessages((prev) => [...prev, msg]);
	}, []);

	return {
		messages,
		streamingText,
		sessionId,
		model,
		connected,
		usage,
		handleServerMessage,
		addUserMessage,
		setConnected,
	};
}
