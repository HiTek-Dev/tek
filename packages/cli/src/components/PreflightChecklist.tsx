import React from "react";
import { Box, Text, useInput } from "ink";

interface PreflightStep {
	description: string;
	toolName?: string;
	risk: "low" | "medium" | "high";
	needsApproval: boolean;
}

interface PreflightChecklistProps {
	checklist: {
		steps: PreflightStep[];
		estimatedCost: {
			inputTokens: number;
			outputTokens: number;
			estimatedUSD: number;
		};
		requiredPermissions: string[];
		warnings: string[];
	};
	onResponse: (approved: boolean) => void;
}

const RISK_COLORS: Record<string, string> = {
	low: "green",
	medium: "yellow",
	high: "red",
};

/**
 * Pre-flight checklist review component.
 *
 * Displays the execution plan steps with risk indicators, estimated costs,
 * required permissions, and warnings. User can approve or cancel execution.
 */
export function PreflightChecklist({
	checklist,
	onResponse,
}: PreflightChecklistProps) {
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
			borderColor="yellow"
			paddingX={1}
			marginBottom={1}
		>
			<Text bold color="yellow">
				Pre-flight Checklist
			</Text>

			{/* Steps */}
			<Box flexDirection="column" marginTop={1}>
				{checklist.steps.map((step, i) => (
					<Box key={`step-${i}`}>
						<Text>
							<Text dimColor>{`${i + 1}. `}</Text>
							<Text
								color={
									RISK_COLORS[step.risk] as
										| "green"
										| "yellow"
										| "red"
								}
							>
								{`[${step.risk.toUpperCase()}] `}
							</Text>
							<Text>{step.description}</Text>
							{step.toolName && (
								<Text dimColor>{` (${step.toolName})`}</Text>
							)}
							{step.needsApproval && (
								<Text color="yellow">{" *approval*"}</Text>
							)}
						</Text>
					</Box>
				))}
			</Box>

			{/* Estimated Cost */}
			<Box marginTop={1}>
				<Text bold dimColor>
					Est. cost:{" "}
				</Text>
				<Text>
					{`~${checklist.estimatedCost.inputTokens.toLocaleString()} in / ~${checklist.estimatedCost.outputTokens.toLocaleString()} out ($${checklist.estimatedCost.estimatedUSD.toFixed(4)})`}
				</Text>
			</Box>

			{/* Required Permissions */}
			{checklist.requiredPermissions.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Text bold dimColor>
						Required permissions:
					</Text>
					{checklist.requiredPermissions.map((perm, i) => (
						<Text key={`perm-${i}`} dimColor>
							{`  - ${perm}`}
						</Text>
					))}
				</Box>
			)}

			{/* Warnings */}
			{checklist.warnings.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					{checklist.warnings.map((warn, i) => (
						<Text key={`warn-${i}`} color="red">
							{`! ${warn}`}
						</Text>
					))}
				</Box>
			)}

			{/* Actions */}
			<Box marginTop={1}>
				<Text>
					<Text bold color="green">
						[Y]
					</Text>
					<Text> Approve and execute </Text>
					<Text bold color="red">
						[N]
					</Text>
					<Text> Cancel</Text>
				</Text>
			</Box>
		</Box>
	);
}
