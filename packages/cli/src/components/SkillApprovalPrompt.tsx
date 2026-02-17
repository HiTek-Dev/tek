import React from "react";
import { Box, Text, useInput } from "ink";

interface SkillApprovalPromptProps {
	toolName: string;
	toolCallId: string;
	args: unknown;
	onResponse: (approved: boolean, sessionApprove?: boolean) => void;
}

/**
 * Enhanced approval prompt for skill_register tool calls.
 *
 * Displays the skill name prominently with a "Skill Registration" header,
 * then delegates to the same approval callback as ToolApprovalPrompt.
 *
 * - Y: Approve skill registration
 * - N: Deny skill registration
 */
export function SkillApprovalPrompt({
	toolName: _toolName,
	toolCallId: _toolCallId,
	args,
	onResponse,
}: SkillApprovalPromptProps) {
	const parsedArgs =
		typeof args === "object" && args !== null
			? (args as Record<string, unknown>)
			: {};
	const skillName = typeof parsedArgs.name === "string" ? parsedArgs.name : "unknown";

	useInput((input) => {
		const key = input.toLowerCase();
		if (key === "y") {
			onResponse(true);
		} else if (key === "n") {
			onResponse(false);
		}
	});

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="magenta"
			paddingX={1}
			marginBottom={1}
		>
			<Text bold color="magenta">
				Skill Registration Approval
			</Text>

			<Box marginTop={1}>
				<Text bold color="blue">
					Skill:{" "}
				</Text>
				<Text bold>{skillName}</Text>
			</Box>

			<Text dimColor>
				The agent wants to register this skill to your workspace.
			</Text>

			<Box marginTop={1}>
				<Text>
					<Text bold color="green">
						[Y]
					</Text>
					<Text> Approve </Text>
					<Text bold color="red">
						[N]
					</Text>
					<Text> Deny</Text>
				</Text>
			</Box>
		</Box>
	);
}
