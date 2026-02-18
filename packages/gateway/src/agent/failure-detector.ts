import { createLogger } from "@tek/core";

const logger = createLogger("failure-detector");

// ── Types ──────────────────────────────────────────────────────────────

/** A record of a single agent step, captured from AI SDK's onStepFinish. */
export interface StepRecord {
	stepType: string;
	finishReason: string;
	toolCalls?: Array<{ toolName: string; input: unknown }>;
	toolResults?: Array<{ toolName: string; output: unknown }>;
	text?: string;
}

/** A classified failure pattern with suggested corrective action. */
export interface FailurePattern {
	pattern:
		| "repeated-tool-error"
		| "no-progress"
		| "max-steps-approaching"
		| "tool-rejection-loop";
	description: string;
	suggestedAction: string;
	affectedTool?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

const ERROR_INDICATORS = [
	"error",
	"Error",
	"ENOENT",
	"EACCES",
	"denied",
	"failed",
];

function outputLooksLikeError(output: unknown): boolean {
	const text = typeof output === "string" ? output : JSON.stringify(output);
	return ERROR_INDICATORS.some((indicator) => text.includes(indicator));
}

function lastN<T>(arr: T[], n: number): T[] {
	return arr.slice(-n);
}

// ── Pattern detectors (priority order) ─────────────────────────────────

function detectRepeatedToolError(
	steps: StepRecord[],
): FailurePattern | null {
	if (steps.length < 3) return null;
	const recent = lastN(steps, 3);

	// All must have tool calls
	if (!recent.every((s) => s.toolCalls && s.toolCalls.length > 0))
		return null;

	// All must use the same tool
	const toolNames = recent.map((s) => s.toolCalls![0].toolName);
	if (new Set(toolNames).size !== 1) return null;
	const toolName = toolNames[0];

	// All must have error-like results
	if (
		!recent.every(
			(s) =>
				s.toolResults &&
				s.toolResults.length > 0 &&
				s.toolResults.some((r) => outputLooksLikeError(r.output)),
		)
	)
		return null;

	logger.info(`Detected repeated-tool-error for tool: ${toolName}`);
	return {
		pattern: "repeated-tool-error",
		description: `Tool "${toolName}" has failed 3 consecutive times with errors`,
		suggestedAction: `Stop using "${toolName}" with the current arguments. Try a different approach or tool.`,
		affectedTool: toolName,
	};
}

function detectToolRejectionLoop(
	steps: StepRecord[],
): FailurePattern | null {
	if (steps.length < 3) return null;
	const recent = lastN(steps, 3);

	// All must have tool calls but no tool results at all
	if (
		!recent.every(
			(s) =>
				s.toolCalls &&
				s.toolCalls.length > 0 &&
				(!s.toolResults || s.toolResults.length === 0),
		)
	)
		return null;

	const toolNames = [
		...new Set(recent.flatMap((s) => s.toolCalls!.map((tc) => tc.toolName))),
	];
	logger.info(
		`Detected tool-rejection-loop for tools: ${toolNames.join(", ")}`,
	);
	return {
		pattern: "tool-rejection-loop",
		description: `Tool calls have been rejected 3 consecutive times (tools: ${toolNames.join(", ")})`,
		suggestedAction:
			"Tool approval is being denied. Ask the user for guidance or proceed without tools.",
		affectedTool: toolNames[0],
	};
}

function detectNoProgress(steps: StepRecord[]): FailurePattern | null {
	if (steps.length < 3) return null;
	const recent = lastN(steps, 3);

	// All must have finishReason === "tool-calls"
	if (!recent.every((s) => s.finishReason === "tool-calls")) return null;

	// All tool results must be identical (or all empty)
	const outputs = recent.map((s) => {
		if (!s.toolResults || s.toolResults.length === 0) return "";
		return JSON.stringify(s.toolResults.map((r) => r.output));
	});
	if (new Set(outputs).size !== 1) return null;

	logger.info("Detected no-progress loop");
	return {
		pattern: "no-progress",
		description:
			"Last 3 steps produced identical tool results with no progress",
		suggestedAction:
			"Break out of the current approach. Try different parameters, a different tool, or ask the user for clarification.",
	};
}

function detectMaxStepsApproaching(
	steps: StepRecord[],
	maxSteps: number,
): FailurePattern | null {
	if (steps.length >= maxSteps - 1) {
		logger.info(
			`Max steps approaching: ${steps.length}/${maxSteps}`,
		);
		return {
			pattern: "max-steps-approaching",
			description: `Agent is at step ${steps.length} of ${maxSteps} maximum steps`,
			suggestedAction:
				"Wrap up the current task quickly. Summarize progress and remaining work if unable to complete.",
		};
	}
	return null;
}

// ── Main classifier ────────────────────────────────────────────────────

/**
 * Classify failure patterns from agent step history.
 *
 * Checks patterns in priority order:
 * 1. repeated-tool-error (same tool failing 3+ times)
 * 2. tool-rejection-loop (tool calls denied 3+ times)
 * 3. no-progress (identical results 3+ times)
 * 4. max-steps-approaching (near step limit)
 *
 * @returns The highest-priority detected pattern, or null if none.
 */
export function classifyFailurePattern(
	steps: StepRecord[],
	maxSteps?: number,
): FailurePattern | null {
	const effectiveMaxSteps = maxSteps ?? 10;

	// Priority order
	const repeatedError = detectRepeatedToolError(steps);
	if (repeatedError) return repeatedError;

	const rejectionLoop = detectToolRejectionLoop(steps);
	if (rejectionLoop) return rejectionLoop;

	const noProgress = detectNoProgress(steps);
	if (noProgress) return noProgress;

	const maxApproaching = detectMaxStepsApproaching(steps, effectiveMaxSteps);
	if (maxApproaching) return maxApproaching;

	return null;
}
