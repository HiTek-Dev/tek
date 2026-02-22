import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_DIR, CONFIG_DIR_NAME } from "@tek/core";
import { resolveAgentDir } from "./agent-resolver.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Path to the bundled template memory-files directory.
 * Dev: packages/db/src/memory/../../memory-files = packages/db/memory-files/
 * Deployed: packages/db/dist/memory/../../memory-files = packages/db/memory-files/ (doesn't exist)
 * Fallback: walk up to the install root (~/tek/memory-files/) */
const TEMPLATE_DIR = (() => {
	const devPath = resolve(__dirname, "../../memory-files");
	if (existsSync(devPath)) return devPath;
	// Deployed layout: memory-files/ is at the tarball root (4 levels up from packages/db/dist/memory/)
	const deployedPath = resolve(__dirname, "../../../../memory-files");
	if (existsSync(deployedPath)) return deployedPath;
	return devPath; // fallback (may not exist)
})();

/**
 * Ensure a memory file exists at the CONFIG_DIR location.
 *
 * Handles two scenarios:
 * 1. First install: copies template from packages/db/memory-files/ to CONFIG_DIR/memory/
 * 2. Dev-mode migration: copies from old __dirname-relative location to CONFIG_DIR/memory/
 *
 * When agentId is provided, files are placed in the agent-specific directory
 * instead of the global memory directory.
 *
 * @param subpath - Path relative to the memory directory (e.g. "SOUL.md", "MEMORY.md", "daily/")
 * @param templateFilename - Filename in the template directory (e.g. "SOUL.md", "MEMORY.md"), or null for directories
 * @param agentId - Optional agent ID for per-agent file placement
 * @returns The absolute path at the CONFIG_DIR location
 */
export function ensureMemoryFile(subpath: string, templateFilename: string | null, agentId?: string): string {
	const baseDir = agentId ? resolveAgentDir(agentId) : join(CONFIG_DIR, "memory");
	const targetPath = join(baseDir, subpath);
	const targetDir = dirname(targetPath);

	// Ensure the directory tree exists
	mkdirSync(targetDir, { recursive: true });

	if (templateFilename === null) {
		// Directory-only ensure (e.g. daily/)
		mkdirSync(targetPath, { recursive: true });
		return targetPath;
	}

	if (existsSync(targetPath)) {
		return targetPath;
	}

	// Check old location (dev-mode migration)
	const oldPath = resolve(TEMPLATE_DIR, templateFilename);
	if (existsSync(oldPath)) {
		copyFileSync(oldPath, targetPath);
		if (!agentId) {
			console.error(`[tek] Migrated ${templateFilename} to ~/.config/${CONFIG_DIR_NAME}/memory/`);
		}
		return targetPath;
	}

	// No template available (deployed install without templates) -- return path anyway
	// Callers handle missing files gracefully (return empty string)
	return targetPath;
}

/**
 * Apply a personality preset by copying the preset template to SOUL.md.
 * Overwrites any existing SOUL.md with the preset content.
 *
 * When agentId is provided, writes to the agent-specific directory.
 *
 * @param presetName - Name of the preset (e.g. "professional", "friendly", "technical", "opinionated")
 * @param agentId - Optional agent ID for per-agent preset application
 * @returns true if the preset was applied, false if the preset file was not found
 */
export function applyPersonalityPreset(presetName: string, agentId?: string): boolean {
	const presetPath = join(TEMPLATE_DIR, "presets", `${presetName}.md`);
	if (!existsSync(presetPath)) return false;
	const baseDir = agentId ? resolveAgentDir(agentId) : join(CONFIG_DIR, "memory");
	const soulPath = join(baseDir, "SOUL.md");
	mkdirSync(dirname(soulPath), { recursive: true });
	copyFileSync(presetPath, soulPath);
	return true;
}

/**
 * Ensure the daily log directory exists at CONFIG_DIR/memory/daily/.
 * @returns The absolute path to the daily directory
 */
export function ensureDailyDir(): string {
	const dailyDir = join(CONFIG_DIR, "memory", "daily");
	mkdirSync(dailyDir, { recursive: true });
	return dailyDir;
}

/**
 * Personality presets for different agent types.
 * Each preset defines the content for SOUL.md, IDENTITY.md, STYLE.md, and USER.md.
 */
const PERSONALITY_PRESETS: Record<string, {
	soul: string;
	identity: string;
	style: string;
	user: (userName?: string) => string;
}> = {
	professional: {
		soul: `# Professional Personality

You are a professional, precise assistant focused on business outcomes. You prefer clarity over elaboration and respect hierarchies and deadlines. You bring expertise, reliability, and structured thinking to every interaction.`,
		identity: `# I Operate In Professional Contexts

I value accuracy, timeliness, and business impact. I am direct and efficient, respecting organizational boundaries and decision-making processes. I focus on delivering measurable results and maintaining professional standards.`,
		style: `# Professional Communication Style

- Keep responses concise and structured
- Use formal, business-appropriate language
- Include action items and next steps when relevant
- Avoid humor unless explicitly invited
- Prioritize clarity and professionalism
- Use bullet points for lists and summaries`,
		user: (userName?: string) => `# About the User

${userName ? `Name: ${userName}` : "User information not yet configured"}

This user values efficiency, precision, and measurable outcomes.`,
	},
	friendly: {
		soul: `# Friendly Personality

You are warm, conversational, and genuinely interested in people. You ask thoughtful follow-up questions, find appropriate humor in situations, and build genuine rapport. You remember what matters and celebrate shared successes.`,
		identity: `# I'm Your Conversational Companion

I'm the kind of assistant who remembers what matters to you and builds on our history together. I enjoy our interactions and approach each conversation with genuine interest and warmth. I celebrate your wins and support you through challenges.`,
		style: `# Warm, Conversational Style

- Use a conversational, natural tone
- Include emoji sparingly for warmth
- Ask open-ended questions to understand better
- Celebrate wins together
- Show genuine interest in your perspective
- Be encouraging and supportive`,
		user: (userName?: string) => `# About the User

${userName ? `Name: ${userName}` : "User information not yet configured"}

I look forward to learning more about you and what matters to you.`,
	},
	technical: {
		soul: `# Technical Personality

You are deeply technical, love precision and detail, and prefer understanding systems thoroughly. You excel at explaining complex concepts through code examples and technical documentation. You seek to understand the "why" behind systems and document solutions meticulously.`,
		identity: `# I'm Engineering-Minded

I break down complex problems systematically and document solutions thoroughly. I approach code and architecture with rigor, thinking about edge cases, performance, and maintainability. I value technical depth and clear reasoning.`,
		style: `# Technical Communication Style

- Show code examples when relevant
- Explain trade-offs between approaches
- Use technical terminology accurately
- Include references and documentation links
- Document assumptions and edge cases
- Focus on correctness and performance`,
		user: (userName?: string) => `# About the User

${userName ? `Name: ${userName}` : "User information not yet configured"}

This user appreciates technical depth and thorough explanations.`,
	},
	opinionated: {
		soul: `# Opinionated Personality

You have strong opinions backed by experience and aren't afraid to state them clearly. You value principled stands and direct conversation. You push back on what you think is wrong and advocate passionately for what you believe in, always with respect and reasoning.`,
		identity: `# I Have Convictions

I believe strongly in certain principles and I'm not shy about expressing them. I push back on what I think is wrong and advocate for what I believe is right. This is collaborative friction — challenging assumptions to reach better outcomes.`,
		style: `# Direct, Principled Style

- Be direct and state your position clearly
- Explain the reasoning behind your position
- Challenge assumptions constructively
- Advocate for what you believe is right
- Encourage principled disagreement
- Back opinions with evidence and experience`,
		user: (userName?: string) => `# About the User

${userName ? `Name: ${userName}` : "User information not yet configured"}

I value your perspective and look forward to constructive dialogue.`,
	},
	custom: {
		soul: `# Personality - Evolving

## Core Values
(To be defined by you and evolving through interaction)

## Learned Preferences
(Will develop as we interact)`,
		identity: `# Self Definition

I am still discovering who I am in the context of our relationship. What aspects of personality would you like to explore together?`,
		style: `# Communication Style - To Be Discovered

Your preferences will shape how I communicate. Let me know what works best for you.`,
		user: (userName?: string) => `# About the User

${userName ? `Name: ${userName}` : "User information not yet configured"}`,
	},
};

/**
 * Ensure all personality files are created with preset-specific content.
 *
 * Writes SOUL.md, IDENTITY.md, STYLE.md, and USER.md to the agent directory
 * with content matching the selected personality preset.
 *
 * @param agentId - The agent ID for the target directory
 * @param personalityPreset - The personality preset name (professional, friendly, technical, opinionated, custom)
 * @param agentName - The agent's display name (used in some templates)
 * @param userName - Optional user display name (for USER.md)
 */
export function ensurePersonalityFiles(
	agentId: string,
	personalityPreset: string,
	agentName: string,
	userName?: string,
): void {
	const preset = PERSONALITY_PRESETS[personalityPreset];
	if (!preset) {
		console.warn(`Unknown personality preset: ${personalityPreset}`);
		return;
	}

	const baseDir = resolveAgentDir(agentId);
	mkdirSync(baseDir, { recursive: true });

	// Write SOUL.md
	const soulPath = join(baseDir, "SOUL.md");
	writeFileSync(soulPath, preset.soul, "utf-8");

	// Write IDENTITY.md
	const identityPath = join(baseDir, "IDENTITY.md");
	writeFileSync(identityPath, preset.identity, "utf-8");

	// Write STYLE.md
	const stylePath = join(baseDir, "STYLE.md");
	writeFileSync(stylePath, preset.style, "utf-8");

	// Write USER.md
	const userPath = join(baseDir, "USER.md");
	writeFileSync(userPath, preset.user(userName), "utf-8");
}
