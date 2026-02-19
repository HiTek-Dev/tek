import { createLogger } from "@tek/core";
import type { StepDefinition, StepResult } from "./types.js";
import { resolveTemplates, type TemplateContext } from "./templates.js";

const logger = createLogger("workflow-executor");

/**
 * Evaluate a branch condition against a step result.
 *
 * Uses `new Function("result", ...)` with restricted scope so only
 * the `result` variable is accessible (per research pitfall guidance).
 */
export function evaluateCondition(
	condition: string,
	result: unknown,
): boolean {
	try {
		const fn = new Function(
			"result",
			'"use strict"; return (' + condition + ");",
		);
		return Boolean(fn(result));
	} catch (err) {
		logger.info(
			`Condition evaluation failed for "${condition}": ${err instanceof Error ? err.message : String(err)}`,
		);
		return false;
	}
}

/**
 * Resolve which step to execute next based on branching rules.
 *
 * Priority:
 * 1. Check branches array (condition/goto pairs) in order
 * 2. Check onSuccess/onFailure based on result status
 * 3. Return null (engine falls through to next step by array index)
 */
export function resolveNextStep(
	step: StepDefinition,
	result: { status: string; output: unknown },
	_steps: StepDefinition[],
): string | null {
	// Check branches first
	if (step.branches && step.branches.length > 0) {
		for (const branch of step.branches) {
			if (evaluateCondition(branch.condition, result.output)) {
				return branch.goto;
			}
		}
	}

	// Check onSuccess / onFailure
	if (result.status === "success" && step.onSuccess) {
		return step.onSuccess;
	}
	if (result.status === "failure" && step.onFailure) {
		return step.onFailure;
	}

	// Fall back to null (engine advances to next step by index)
	return null;
}

export interface StepExecutionContext {
	steps: Record<string, StepResult>;
	tools: Record<string, unknown>;
	error?: string;
}

/**
 * Execute a single workflow step.
 *
 * Supports three action types:
 * - "tool": resolve templates in args, call tool's execute function
 * - "model": resolve templates in prompt, call generateText
 * - "noop": return success with null output
 *
 * Applies step.timeout via AbortController if set.
 */
export async function executeStep(
	step: StepDefinition,
	context: StepExecutionContext,
): Promise<StepResult> {
	const templateCtx: TemplateContext = {
		steps: Object.fromEntries(
			Object.entries(context.steps).map(([id, sr]) => [
				id,
				{ output: sr.output, status: sr.status },
			]),
		),
		error: context.error,
	};

	try {
		// Set up timeout if specified
		let abortController: AbortController | undefined;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		if (step.timeout) {
			abortController = new AbortController();
			timeoutId = setTimeout(
				() => abortController!.abort(),
				step.timeout,
			);
		}

		try {
			const result = await executeAction(
				step,
				templateCtx,
				context,
				abortController?.signal,
			);
			return result;
		} finally {
			if (timeoutId) clearTimeout(timeoutId);
		}
	} catch (err) {
		const message =
			err instanceof Error ? err.message : String(err);
		logger.info(`Step ${step.id} failed: ${message}`);
		return {
			status: "failure",
			output: message,
			completedAt: new Date().toISOString(),
		};
	}
}

/**
 * Execute the action for a step based on its action type.
 */
async function executeAction(
	step: StepDefinition,
	templateCtx: TemplateContext,
	context: StepExecutionContext,
	_signal?: AbortSignal,
): Promise<StepResult> {
	switch (step.action) {
		case "tool": {
			if (!step.tool) {
				throw new Error(
					`Step ${step.id}: action "tool" requires a tool name`,
				);
			}

			const tool = context.tools[step.tool] as
				| { execute?: (args: unknown) => Promise<unknown> }
				| undefined;
			if (!tool || typeof tool.execute !== "function") {
				throw new Error(
					`Step ${step.id}: tool "${step.tool}" not found or has no execute function`,
				);
			}

			// Resolve templates in args
			let resolvedArgs: Record<string, unknown> = {};
			if (step.args) {
				resolvedArgs = Object.fromEntries(
					Object.entries(step.args).map(([key, value]) => [
						key,
						typeof value === "string"
							? resolveTemplates(value, templateCtx)
							: value,
					]),
				);
			}

			const output = await tool.execute(resolvedArgs);
			return {
				status: "success",
				output,
				completedAt: new Date().toISOString(),
			};
		}

		case "model": {
			if (!step.prompt) {
				throw new Error(
					`Step ${step.id}: action "model" requires a prompt`,
				);
			}

			const resolvedPrompt = resolveTemplates(
				step.prompt,
				templateCtx,
			);

			// Use AI SDK generateText
			const { generateText } = await import("ai");
			const { getRegistry } = await import("../llm/registry.js");

			const registry = getRegistry();
			// Use the configured default model for workflow steps
			const { getDefaultModel } = await import("@tek/core");
			const workflowModel = getDefaultModel() ?? "ollama:llama3";
			const model = registry.languageModel(workflowModel as never);

			const result = await generateText({
				model,
				prompt: resolvedPrompt,
			});

			return {
				status: "success",
				output: result.text,
				completedAt: new Date().toISOString(),
			};
		}

		case "noop": {
			return {
				status: "success",
				output: null,
				completedAt: new Date().toISOString(),
			};
		}

		default: {
			throw new Error(
				`Step ${step.id}: unknown action "${step.action}"`,
			);
		}
	}
}
