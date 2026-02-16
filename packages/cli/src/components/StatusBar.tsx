import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
	connected: boolean;
	sessionId: string | null;
	model: string;
	usage: {
		totalTokens: number;
		totalCost: number;
	};
}

/**
 * Single-line status bar showing connection state, session, model, and usage.
 * Displayed at the top of the chat interface.
 */
export function StatusBar({ connected, sessionId, model, usage }: StatusBarProps) {
	// Shorten model name for display (e.g., "claude-sonnet-4-5-20250929" -> "sonnet-4-5")
	const shortModel = model
		.replace("claude-", "")
		.replace(/-\d{8}$/, "");

	const sessionDisplay = sessionId ? sessionId.slice(0, 8) : "No session";

	return (
		<Box
			borderStyle="single"
			borderColor="gray"
			paddingX={1}
			justifyContent="space-between"
		>
			<Box>
				<Text color={connected ? "green" : "red"}>
					{"● "}
				</Text>
				<Text bold>AgentSpace</Text>
			</Box>
			<Text dimColor>{sessionDisplay}</Text>
			<Box>
				<Text color="cyan">{shortModel}</Text>
				<Text dimColor>
					{" "}
					{usage.totalTokens.toLocaleString()} tok | $
					{usage.totalCost.toFixed(4)}
				</Text>
			</Box>
		</Box>
	);
}
