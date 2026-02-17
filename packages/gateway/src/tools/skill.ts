import { tool } from "ai";
import { z } from "zod";
import { writeSkill } from "@agentspace/core";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Create a skill_draft tool that writes a SKILL.md to a sandbox directory.
 * Drafting is safe (writes to temp dir only), so it can use default approval tier.
 */
export function createSkillDraftTool(sandboxDir: string) {
	return tool({
		description:
			"Draft a new skill as a SKILL.md file in a sandbox directory for user review. Use this when you've identified a recurring task pattern that should become a reusable skill.",
		inputSchema: z.object({
			name: z
				.string()
				.describe("Skill name in slug format (e.g. 'code-review')"),
			description: z
				.string()
				.describe("One-sentence description of what the skill does"),
			instructions: z
				.string()
				.describe("Full markdown instructions for the skill"),
			tools: z
				.array(z.string())
				.optional()
				.describe("Tool names the skill needs access to"),
			triggers: z
				.array(z.string())
				.optional()
				.describe("Conditions that activate this skill"),
		}),
		execute: async ({ name, description, instructions, tools, triggers }) => {
			const skillPath = writeSkill(
				sandboxDir,
				{
					name,
					description,
					tier: "workspace",
					version: "1.0.0",
					tools: tools ?? [],
					triggers: triggers ?? [],
				},
				instructions,
			);

			return {
				skillPath,
				name,
				description,
				status: "drafted" as const,
			};
		},
	});
}

/**
 * Create a skill_register tool that copies a drafted skill from sandbox to workspace.
 * This tool should have "always" approval tier since it modifies the workspace.
 */
export function createSkillRegisterTool(
	sandboxDir: string,
	workspaceSkillsDir: string,
) {
	return tool({
		description:
			"Register a previously drafted skill by copying it from the sandbox to the workspace skills directory. Requires user approval.",
		inputSchema: z.object({
			name: z
				.string()
				.describe("The skill name from a prior skill_draft call"),
		}),
		execute: async ({ name }) => {
			const sourcePath = join(sandboxDir, name, "SKILL.md");
			if (!existsSync(sourcePath)) {
				throw new Error(
					`Drafted skill '${name}' not found at ${sourcePath}. Run skill_draft first.`,
				);
			}

			const destDir = join(workspaceSkillsDir, name);
			mkdirSync(destDir, { recursive: true });

			const destPath = join(destDir, "SKILL.md");
			copyFileSync(sourcePath, destPath);

			return {
				name,
				registeredPath: destPath,
				status: "registered" as const,
			};
		},
	});
}
