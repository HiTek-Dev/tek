import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { SkillMetadata } from "./types.js";

/**
 * Write a SKILL.md file with gray-matter frontmatter to a directory.
 * Creates the skill subdirectory if it doesn't exist.
 *
 * @param skillsDir - Parent directory for skills (e.g. sandbox or workspace skills dir)
 * @param metadata  - Skill metadata for frontmatter
 * @param instructions - Markdown instructions body
 * @returns Absolute path to the written SKILL.md file
 */
export function writeSkill(
	skillsDir: string,
	metadata: SkillMetadata,
	instructions: string,
): string {
	const skillDir = join(skillsDir, metadata.name);
	mkdirSync(skillDir, { recursive: true });

	const content = matter.stringify(instructions, {
		name: metadata.name,
		description: metadata.description,
		tier: metadata.tier ?? "workspace",
		version: metadata.version ?? "1.0.0",
		tools: metadata.tools ?? [],
		triggers: metadata.triggers ?? [],
	});

	const skillPath = join(skillDir, "SKILL.md");
	writeFileSync(skillPath, content, "utf-8");
	return skillPath;
}
