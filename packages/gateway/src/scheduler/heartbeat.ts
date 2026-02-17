import { readFileSync } from "node:fs";
import matter from "gray-matter";
import { generateText, stepCountIs } from "ai";
import type { LanguageModel } from "ai";
import { HeartbeatConfigSchema } from "./types.js";
import type { HeartbeatConfig } from "./types.js";

export interface HeartbeatCheckResult {
	description: string;
	actionNeeded: boolean;
	details?: string;
}

/**
 * Load and parse a HEARTBEAT.md file.
 *
 * Extracts frontmatter config (validated against HeartbeatConfigSchema)
 * and checklist items from the markdown body.
 */
export function loadHeartbeatConfig(heartbeatPath: string): {
	config: HeartbeatConfig;
	checklistItems: string[];
} {
	const raw = readFileSync(heartbeatPath, "utf-8");
	const { data, content } = matter(raw);
	const config = HeartbeatConfigSchema.parse(data);

	// Extract checklist items: lines matching `- [ ] text` or `- [x] text`
	const checklistItems: string[] = [];
	for (const line of content.split("\n")) {
		const match = line.match(/^\s*-\s*\[[ x]\]\s+(.+)/);
		if (match) {
			checklistItems.push(match[1].trim());
		}
	}

	return { config, checklistItems };
}

/**
 * HeartbeatRunner loads a HEARTBEAT.md checklist and runs
 * agent-powered checks sequentially. Each checklist item
 * is evaluated by an AI agent that determines if action is needed.
 */
export class HeartbeatRunner {
	private heartbeatPath: string;

	constructor(heartbeatPath: string) {
		this.heartbeatPath = heartbeatPath;
	}

	/**
	 * Run all checklist items sequentially and return structured results.
	 *
	 * Each item is checked by an AI agent with access to the provided tools.
	 * Results indicate whether action is needed for each check.
	 */
	async run(
		tools: Record<string, unknown>,
		model: LanguageModel,
	): Promise<HeartbeatCheckResult[]> {
		const { checklistItems } = loadHeartbeatConfig(this.heartbeatPath);
		const results: HeartbeatCheckResult[] = [];

		// Run checks sequentially (not parallel -- per research anti-pattern)
		for (const item of checklistItems) {
			const result = await this.checkItem(item, tools, model);
			results.push(result);
		}

		return results;
	}

	/**
	 * Reload and return the current heartbeat configuration.
	 * Allows hot-reload of HEARTBEAT.md without restarting.
	 */
	getConfig(): { config: HeartbeatConfig; checklistItems: string[] } {
		return loadHeartbeatConfig(this.heartbeatPath);
	}

	/**
	 * Check a single checklist item using an AI agent.
	 */
	private async checkItem(
		item: string,
		tools: Record<string, unknown>,
		model: LanguageModel,
	): Promise<HeartbeatCheckResult> {
		try {
			const response = await generateText({
				model,
				system:
					"You are a monitoring agent. Check the following item and determine if any action is needed. " +
					'Respond with JSON: {"actionNeeded": boolean, "details": "brief explanation"}. ' +
					"Only set actionNeeded to true if the user MUST take action.",
				prompt: `Check: ${item}\nUse the available tools to verify this.`,
				tools: tools as Parameters<typeof generateText>[0]["tools"],
				stopWhen: stepCountIs(5),
			});

			try {
				const parsed = JSON.parse(response.text) as {
					actionNeeded: boolean;
					details?: string;
				};
				return {
					description: item,
					actionNeeded: parsed.actionNeeded,
					details: parsed.details,
				};
			} catch {
				// If the response isn't valid JSON, treat as no action needed
				return {
					description: item,
					actionNeeded: false,
					details: "Check could not be evaluated",
				};
			}
		} catch {
			return {
				description: item,
				actionNeeded: false,
				details: "Check could not be evaluated",
			};
		}
	}
}
