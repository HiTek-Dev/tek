import React, { useCallback } from "react";
import { Box, Text, Static } from "ink";
import { TextInput } from "@inkjs/ui";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { useChat } from "../hooks/useChat.js";
import { createChatSendMessage } from "../lib/gateway-client.js";

interface ChatProps {
	wsUrl: string;
	initialModel?: string;
	resumeSessionId?: string;
}

/**
 * Minimal chat shell component. Connects to the gateway via WebSocket,
 * displays messages, and accepts user input. Plan 03-02 replaces these
 * raw renderings with proper MessageBubble, StatusBar, etc.
 */
export function Chat({ wsUrl, initialModel, resumeSessionId }: ChatProps) {
	const {
		messages,
		streamingText,
		sessionId,
		model,
		connected,
		usage,
		handleServerMessage,
		addUserMessage,
		setConnected,
	} = useChat({ initialModel, resumeSessionId });

	const { send } = useWebSocket({
		url: wsUrl,
		onMessage: handleServerMessage,
		onClose: useCallback(() => setConnected(false), [setConnected]),
	});

	// Sync WebSocket connected state into chat state
	// The useWebSocket hook tracks its own connected state, but we also
	// need to update the chat hook's connected state for rendering
	const handleSubmit = useCallback(
		(value: string) => {
			const trimmed = value.trim();
			if (!trimmed) return;

			addUserMessage(trimmed);
			send(createChatSendMessage(trimmed, { sessionId: sessionId ?? undefined, model }));
		},
		[addUserMessage, send, sessionId, model],
	);

	return (
		<Box flexDirection="column" padding={1}>
			{/* Connection status */}
			<Box marginBottom={1}>
				<Text color={connected ? "green" : "red"}>
					{connected ? "Connected" : "Disconnected"}
				</Text>
				{sessionId && (
					<Text dimColor> | Session: {sessionId}</Text>
				)}
				{usage.totalTokens > 0 && (
					<Text dimColor>
						{" "}| Tokens: {usage.totalTokens} | Cost: $
						{usage.totalCost.toFixed(4)}
					</Text>
				)}
			</Box>

			{/* Message history */}
			<Static items={messages}>
				{(msg) => (
					<Box key={msg.id}>
						<Text
							color={
								msg.type === "text" && msg.role === "user"
									? "blue"
									: msg.type === "text" && msg.role === "assistant"
										? "green"
										: "yellow"
							}
						>
							{msg.type === "text" ? msg.role : msg.type}:{" "}
						</Text>
						<Text>{msg.type === "text" || msg.type === "reasoning" ? msg.content : msg.type === "tool_call" ? msg.toolName : msg.type === "bash_command" ? msg.command : ""}</Text>
					</Box>
				)}
			</Static>

			{/* Streaming response */}
			{streamingText ? (
				<Box>
					<Text color="green">assistant: </Text>
					<Text>{streamingText}</Text>
				</Box>
			) : null}

			{/* Input */}
			<Box marginTop={1}>
				<Text bold color="blue">
					{">"}{" "}
				</Text>
				<TextInput
					placeholder="Type a message..."
					onSubmit={handleSubmit}
				/>
			</Box>
		</Box>
	);
}
