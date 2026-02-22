import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";

interface StreamingResponseProps {
	text: string;
	reasoningText?: string;
	model?: string;
}

/**
 * Displays the currently streaming assistant response.
 * Shows plain text while streaming (no markdown to avoid partial-parse artifacts).
 * Shows a spinner when waiting for the first token.
 * When reasoning is available, shows a dimmed italic preview above the response.
 */
export function StreamingResponse({ text, reasoningText, model }: StreamingResponseProps) {
	const reasoningPreview = reasoningText && reasoningText.length > 120
		? reasoningText.slice(0, 117) + "..."
		: reasoningText;

	return (
		<Box flexDirection="column">
			<Box>
				<Text bold color="magenta">
					{"* Assistant"}
				</Text>
				{model && <Text dimColor> ({model})</Text>}
			</Box>
			{reasoningPreview && (
				<Box>
					<Text dimColor italic>{"~ "}{reasoningPreview}</Text>
				</Box>
			)}
			{text ? (
				<Text>{text}</Text>
			) : (
				<Spinner label="Thinking..." />
			)}
		</Box>
	);
}
