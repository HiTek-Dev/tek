import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "@tek/core";
import { ensureMemoryFile } from "./ensure-memory.js";
import { resolveIdentityFile, resolveAgentDir } from "./agent-resolver.js";

/** Path to the soul identity document */
const SOUL_PATH = join(CONFIG_DIR, "memory", "SOUL.md");

/**
 * Get the path to the SOUL.md file.
 */
export function getSoulPath(): string {
	return SOUL_PATH;
}

/**
 * Load the contents of SOUL.md.
 * Seeds from template on first run, migrates from old location if needed.
 * Returns empty string if the file doesn't exist and no template is available.
 *
 * When agentId is provided, uses cascade resolution
 * (agent-specific > shared > global) instead of the global path.
 */
export function loadSoul(agentId?: string): string {
	// Per-agent resolution via cascade
	if (agentId) {
		return resolveIdentityFile(agentId, "SOUL.md");
	}

	// Default/global path
	ensureMemoryFile("SOUL.md", "SOUL.md");
	if (!existsSync(SOUL_PATH)) {
		return "";
	}
	return readFileSync(SOUL_PATH, "utf-8");
}

/**
 * Update a specific section in an identity file.
 * Finds the section by ## header, replaces content between this header and the next.
 * If section not found, appends at end.
 */
export function updateIdentityFileSection(
	filename: string,
	section: string,
	newContent: string,
	agentId?: string,
): void {
	const dir = agentId ? resolveAgentDir(agentId) : join(CONFIG_DIR, "memory");
	const filePath = join(dir, filename);
	if (!existsSync(filePath)) return;

	let content = readFileSync(filePath, "utf-8");
	const sectionHeader = `## ${section}`;
	const headerIndex = content.indexOf(sectionHeader);

	if (headerIndex === -1) {
		// Section not found, append
		content = content.trimEnd() + `\n\n${sectionHeader}\n${newContent}\n`;
	} else {
		// Find end of header line
		const afterHeader = content.indexOf("\n", headerIndex);
		if (afterHeader === -1) return;

		// Find next section
		const remaining = content.slice(afterHeader + 1);
		const nextSectionMatch = remaining.search(/^## /m);

		if (nextSectionMatch !== -1) {
			const insertEnd = afterHeader + 1 + nextSectionMatch;
			content = content.slice(0, afterHeader + 1) + newContent + "\n\n" + content.slice(insertEnd);
		} else {
			content = content.slice(0, afterHeader + 1) + newContent + "\n";
		}
	}

	writeFileSync(filePath, content, "utf-8");
}

/**
 * Append a learned preference to the `## Learned Preferences` section of SOUL.md.
 * This is called after user approval (not auto-evolved).
 */
export function evolveSoul(preference: string): void {
	let content = loadSoul();
	if (!content) {
		return;
	}

	const sectionHeader = "## Learned Preferences";
	const headerIndex = content.indexOf(sectionHeader);
	if (headerIndex === -1) {
		return;
	}

	// Find the end of the header line
	const afterHeader = content.indexOf("\n", headerIndex);
	if (afterHeader === -1) {
		return;
	}

	// Find where the next section starts
	const remaining = content.slice(afterHeader + 1);
	const nextSectionMatch = remaining.search(/^## /m);

	let insertPos: number;
	if (nextSectionMatch !== -1) {
		insertPos = afterHeader + 1 + nextSectionMatch;
	} else {
		insertPos = content.length;
	}

	const today = new Date().toISOString().slice(0, 10);
	const newEntry = `- ${preference} (learned ${today})\n`;
	content = content.slice(0, insertPos) + newEntry + content.slice(insertPos);

	writeFileSync(SOUL_PATH, content, "utf-8");
}
