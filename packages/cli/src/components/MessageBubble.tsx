import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "../lib/gateway-client.js";
import { MarkdownRenderer } from "./MarkdownRenderer.js";

interface MessageBubbleProps {
	message: ChatMessage;
}

/**
 * Renders a single chat message with type-based styling.
 * - text/user: cyan prompt indicator with plain text
 * - text/assistant: magenta header with full markdown rendering
 * - text/system: dimmed yellow for system/error messages
 * - tool_call: blue tool header with input/output (Phase 6)
 * - bash_command: green terminal-style display (Phase 6)
 * - reasoning: dimmed italic thinking trace (Phase 6)
 */
export function MessageBubble({ message }: MessageBubbleProps) {
	switch (message.type) {
		case "text": {
			switch (message.role) {
				case "user":
					return (
						<Box marginBottom={1}>
							<Text bold color="cyan">
								{"> "}
							</Text>
							<Text>{message.content}</Text>
						</Box>
					);
				case "assistant":
					return (
						<Box flexDirection="column" marginBottom={1}>
							<Text bold color="magenta">
								{"* Assistant"}
							</Text>
							<MarkdownRenderer content={message.content} />
						</Box>
					);
				case "system":
					return (
						<Box marginBottom={1}>
							<Text color="yellow" dimColor>
								{"! "}
								{message.content}
							</Text>
						</Box>
					);
			}
			break;
		}

		case "tool_call":
			return (
				<Box flexDirection="column" marginBottom={1}>
					<Text bold color="blue">
						{"# Tool: "}
						{message.toolName}
					</Text>
					<Text dimColor>{message.input}</Text>
					{message.output && <Text>{message.output}</Text>}
				</Box>
			);

		case "bash_command":
			return (
				<Box flexDirection="column" marginBottom={1}>
					<Text bold color="green">
						{"$ "}
						{message.command}
					</Text>
					{message.output && <Text dimColor>{message.output}</Text>}
				</Box>
			);

		case "reasoning":
			return (
				<Box marginBottom={1}>
					<Text dimColor italic>
						{"~ "}
						{message.content}
					</Text>
				</Box>
			);
	}
}
