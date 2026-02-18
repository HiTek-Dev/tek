import matter from "gray-matter";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createLogger } from "../logger.js";
import { CONFIG_DIR_NAME } from "../config/constants.js";
import { SkillMetadataSchema } from "./types.js";
import type { LoadedSkill, SkillTier } from "./types.js";

const logger = createLogger("skills");

/**
 * Discover and load SKILL.md files from workspace and managed directories.
 * Workspace skills override managed skills with the same name.
 */
export function discoverSkills(dirs: {
	workspace?: string;
	managed?: string;
}): LoadedSkill[] {
	const managedSkills = dirs.managed
		? loadSkillsFromDir(dirs.managed, "managed")
		: [];
	const workspaceSkills = dirs.workspace
		? loadSkillsFromDir(dirs.workspace, "workspace")
		: [];

	// Index managed skills by name, then let workspace override
	const skillMap = new Map<string, LoadedSkill>();
	for (const skill of managedSkills) {
		skillMap.set(skill.metadata.name, skill);
	}
	for (const skill of workspaceSkills) {
		skillMap.set(skill.metadata.name, skill);
	}

	// Sort by name for deterministic ordering
	return Array.from(skillMap.values()).sort((a, b) =>
		a.metadata.name.localeCompare(b.metadata.name),
	);
}

/**
 * Resolve skills directories from config.
 */
export function getSkillsDirs(config: {
	workspaceDir?: string;
	skillsDir?: string;
}): { workspace?: string; managed?: string } {
	const managed = config.skillsDir
		? config.skillsDir
		: join(homedir(), ".config", CONFIG_DIR_NAME, "skills");

	const workspace = config.workspaceDir
		? join(config.workspaceDir, `.${CONFIG_DIR_NAME}`, "skills")
		: undefined;

	return { workspace, managed };
}

/**
 * Format loaded skills into a context section string.
 * Returns empty string if no skills.
 */
export function formatSkillsForContext(skills: LoadedSkill[]): string {
	if (skills.length === 0) return "";

	return skills
		.map(
			(skill) =>
				`## ${skill.metadata.name}\n${skill.metadata.description}\n\n${skill.instructions.trim()}`,
		)
		.join("\n\n");
}

function loadSkillsFromDir(dir: string, tier: SkillTier): LoadedSkill[] {
	if (!existsSync(dir)) return [];

	const skills: LoadedSkill[] = [];

	let entries: import("node:fs").Dirent[];
	try {
		entries = readdirSync(dir, { withFileTypes: true }) as import("node:fs").Dirent[];
	} catch {
		logger.warn("Failed to read skills directory", { dir });
		return [];
	}

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const skillPath = join(dir, entry.name as string, "SKILL.md");
		try {
			const raw = readFileSync(skillPath, "utf-8");
			const { data, content } = matter(raw);
			const result = SkillMetadataSchema.safeParse(data);
			if (!result.success) {
				logger.warn("Invalid SKILL.md metadata, skipping", {
					path: skillPath,
					error: result.error.message,
				});
				continue;
			}
			skills.push({
				metadata: result.data,
				instructions: content,
				path: skillPath,
				tier,
			});
		} catch {
			// Skip skills that can't be read (missing SKILL.md, etc.)
		}
	}

	return skills;
}
