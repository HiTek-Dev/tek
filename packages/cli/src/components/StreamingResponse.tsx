import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "@inkjs/ui";

interface StreamingResponseProps {
	text: string;
	model?: string;
}

/**
 * Displays the currently streaming assistant response.
 * Shows plain text while streaming (no markdown to avoid partial-parse artifacts).
 * Shows a spinner when waiting for the first token.
 */
export function StreamingResponse({ text, model }: StreamingResponseProps) {
	return (
		<Box flexDirection="column">
			<Box>
				<Text bold color="magenta">
					{"* Assistant"}
				</Text>
				{model && <Text dimColor> ({model})</Text>}
			</Box>
			{text ? (
				<Text>{text}</Text>
			) : (
				<Spinner label="Thinking..." />
			)}
		</Box>
	);
}
