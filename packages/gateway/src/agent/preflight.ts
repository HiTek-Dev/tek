import { generateObject } from "ai";
import { z } from "zod";
import { createLogger } from "@agentspace/core";
import { getRegistry } from "../llm/registry.js";

const logger = createLogger("preflight");

// ── Schema ──────────────────────────────────────────────────────────────

export const PreflightChecklistSchema = z.object({
	steps: z.array(
		z.object({
			description: z.string(),
			toolName: z.string().optional(),
			risk: z.enum(["low", "medium", "high"]),
			needsApproval: z.boolean(),
		}),
	),
	estimatedCost: z.object({
		inputTokens: z.number(),
		outputTokens: z.number(),
		estimatedUSD: z.number(),
	}),
	requiredPermissions: z.array(z.string()),
	warnings: z.array(z.string()),
});

export type PreflightChecklist = z.infer<typeof PreflightChecklistSchema>;

// ── Heuristic trigger ───────────────────────────────────────────────────

/** Keywords that suggest complex, multi-step, or destructive operations. */
const COMPLEX_KEYWORDS = [
	"refactor",
	"delete",
	"deploy",
	"install",
	"migrate",
	"update all",
	"fix all",
	"remove all",
	"rename all",
	"replace all",
];

/**
 * Determine whether a user message warrants a pre-flight checklist.
 *
 * Returns true if:
 * - Message is longer than 200 characters (complex request)
 * - Message contains keywords indicating destructive or broad operations
 * - More than 5 tools are available (complex environment)
 */
export function shouldTriggerPreflight(
	userMessage: string,
	availableTools: Record<string, unknown>,
): boolean {
	// Short messages about simple questions never trigger
	if (userMessage.length < 30) return false;

	// Long messages suggest complex instructions
	if (userMessage.length > 200) return true;

	// Check for complex/destructive keywords
	const lower = userMessage.toLowerCase();
	if (COMPLEX_KEYWORDS.some((kw) => lower.includes(kw))) return true;

	// Many tools available suggests complex environment
	if (Object.keys(availableTools).length > 5) return true;

	return false;
}

// ── Generator ───────────────────────────────────────────────────────────

/**
 * Generate a pre-flight checklist using an LLM structured output call.
 *
 * Analyzes the user request and available tools to produce:
 * - Ordered steps the agent will likely take
 * - Estimated token cost
 * - Required permissions
 * - Risk warnings
 */
export async function generatePreflight(
	model: string,
	userMessage: string,
	availableTools: Record<string, unknown>,
): Promise<PreflightChecklist> {
	const registry = getRegistry();
	const languageModel = registry.languageModel(model as never);

	// Build tool description list for the prompt
	const toolDescriptions = Object.entries(availableTools)
		.map(([name, def]) => {
			const description =
				typeof def === "object" && def !== null && "description" in def
					? String((def as Record<string, unknown>).description)
					: "No description";
			return `- ${name}: ${description}`;
		})
		.join("\n");

	const { object } = await generateObject({
		model: languageModel,
		schema: PreflightChecklistSchema,
		prompt: `Analyze this user request and create an execution plan.

User request: "${userMessage}"

Available tools:
${toolDescriptions || "(none)"}

List the steps the agent will likely take to complete this request.
For each step, indicate:
- A clear description of what will be done
- Which tool will be used (if any)
- Risk level (low/medium/high)
- Whether user approval should be required before executing

Also estimate:
- Token usage (input and output tokens)
- Cost in USD
- Required permissions (file system access, network, etc.)
- Any warnings or risks the user should know about

Be concise but thorough.`,
	});

	logger.info(
		`Generated preflight checklist: ${object.steps.length} steps, ${object.warnings.length} warnings`,
	);

	return object;
}
