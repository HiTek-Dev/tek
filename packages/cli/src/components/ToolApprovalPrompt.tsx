import React from "react";
import { Box, Text, useInput } from "ink";

interface ToolApprovalPromptProps {
	toolName: string;
	toolCallId: string;
	args: unknown;
	onResponse: (approved: boolean, sessionApprove?: boolean) => void;
}

/**
 * Interactive approval prompt for tool calls.
 *
 * Displays the tool name and arguments, and listens for keyboard input:
 * - Y: Approve this tool call
 * - N: Deny this tool call
 * - S: Approve for the entire session (skip future approvals for this tool)
 */
export function ToolApprovalPrompt({
	toolName,
	toolCallId: _toolCallId,
	args,
	onResponse,
}: ToolApprovalPromptProps) {
	const argsStr =
		typeof args === "string" ? args : JSON.stringify(args, null, 2);

	useInput((input) => {
		const key = input.toLowerCase();
		if (key === "y") {
			onResponse(true);
		} else if (key === "n") {
			onResponse(false);
		} else if (key === "s") {
			onResponse(true, true);
		}
	});

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="yellow"
			paddingX={1}
			marginBottom={1}
		>
			<Text bold color="yellow">
				Tool Approval Required
			</Text>

			<Box marginTop={1}>
				<Text bold color="blue">
					Tool:{" "}
				</Text>
				<Text>{toolName}</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text bold dimColor>
					Arguments:
				</Text>
				<Text dimColor>{argsStr}</Text>
			</Box>

			<Box marginTop={1}>
				<Text>
					<Text bold color="green">
						[Y]
					</Text>
					<Text> Approve </Text>
					<Text bold color="red">
						[N]
					</Text>
					<Text> Deny </Text>
					<Text bold color="cyan">
						[S]
					</Text>
					<Text> Approve for session</Text>
				</Text>
			</Box>
		</Box>
	);
}
