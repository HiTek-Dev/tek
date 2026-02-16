import React from "react";
import { Static } from "ink";
import type { ChatMessage } from "../lib/gateway-client.js";
import { MessageBubble } from "./MessageBubble.js";

interface MessageListProps {
	messages: ChatMessage[];
}

/**
 * Renders completed messages using Ink's Static component for efficient
 * append-only rendering. Messages are rendered once and never re-rendered.
 */
export function MessageList({ messages }: MessageListProps) {
	return (
		<Static items={messages}>
			{(msg) => <MessageBubble key={msg.id} message={msg} />}
		</Static>
	);
}
