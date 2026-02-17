/**
 * Template resolver for workflow step definitions.
 *
 * Resolves {{steps.stepId.result}}, {{steps.stepId.output}},
 * {{steps | json}}, and {{error}} placeholders in prompt/args fields.
 *
 * IMPORTANT: Only resolve templates in prompt and args fields of step
 * definitions, never in step result outputs (prevents template injection).
 */

export interface TemplateContext {
	steps: Record<string, { output: unknown; status: string }>;
	error?: string;
}

const TEMPLATE_RE = /\{\{(.+?)\}\}/g;

/**
 * Resolve template placeholders in a string using the given context.
 *
 * Supported patterns:
 * - {{steps.stepId.result}} or {{steps.stepId.output}} - step output
 * - {{steps | json}} - JSON of all step results
 * - {{error}} - current error or "No error"
 */
export function resolveTemplates(
	template: string,
	context: TemplateContext,
): string {
	return template.replace(TEMPLATE_RE, (_match, expr: string) => {
		const trimmed = expr.trim();

		// {{steps | json}} - full step results as JSON
		if (trimmed === "steps | json") {
			return JSON.stringify(context.steps);
		}

		// {{error}} - error message
		if (trimmed === "error") {
			return context.error ?? "No error";
		}

		// {{steps.stepId.result}} or {{steps.stepId.output}}
		const stepMatch = trimmed.match(
			/^steps\.([^.]+)\.(result|output|status)$/,
		);
		if (stepMatch) {
			const [, stepId, field] = stepMatch;
			const stepData = context.steps[stepId];
			if (!stepData) return "";

			if (field === "status") {
				return stepData.status;
			}
			// result and output both map to output
			const value = stepData.output;
			if (value === null || value === undefined) return "";
			if (typeof value === "string") return value;
			return JSON.stringify(value);
		}

		// Unknown template - return as-is
		return _match;
	});
}
