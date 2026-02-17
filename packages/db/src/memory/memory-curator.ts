import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "@agentspace/core";
import { ensureMemoryFile } from "./ensure-memory.js";

/** Path to the long-term memory file */
const MEMORY_PATH = join(CONFIG_DIR, "memory", "MEMORY.md");

/** Valid section headers in MEMORY.md */
export type MemorySection =
	| "User Facts"
	| "Project Context"
	| "Preferences"
	| "Important Decisions";

/**
 * Get the path to the MEMORY.md file.
 */
export function getMemoryPath(): string {
	return MEMORY_PATH;
}

/**
 * Load the contents of MEMORY.md.
 * Seeds from template on first run, migrates from old location if needed.
 * Returns empty string if the file doesn't exist and no template is available.
 */
export function loadLongTermMemory(): string {
	ensureMemoryFile("MEMORY.md", "MEMORY.md");
	if (!existsSync(MEMORY_PATH)) {
		return "";
	}
	return readFileSync(MEMORY_PATH, "utf-8");
}

/**
 * Add an entry to a specific section in MEMORY.md.
 * Finds the `## {section}` header and appends `- {entry}` after it,
 * before the next section or `---` separator.
 * Updates the `*Last updated:*` footer with the current date.
 */
export function addMemoryEntry(section: MemorySection, entry: string): void {
	let content = loadLongTermMemory();
	if (!content) {
		return;
	}

	const sectionHeader = `## ${section}`;
	const headerIndex = content.indexOf(sectionHeader);
	if (headerIndex === -1) {
		return;
	}

	// Find the end of the header line
	const afterHeader = content.indexOf("\n", headerIndex);
	if (afterHeader === -1) {
		return;
	}

	// Find where the next section or separator starts
	const remaining = content.slice(afterHeader + 1);
	const nextSectionMatch = remaining.search(/^## /m);
	const nextSeparator = remaining.indexOf("\n---");

	let insertPos: number;
	if (nextSectionMatch !== -1 && (nextSeparator === -1 || nextSectionMatch < nextSeparator)) {
		insertPos = afterHeader + 1 + nextSectionMatch;
	} else if (nextSeparator !== -1) {
		insertPos = afterHeader + 1 + nextSeparator;
	} else {
		insertPos = content.length;
	}

	// Insert the new entry before the next section/separator
	const newEntry = `- ${entry}\n`;
	content = content.slice(0, insertPos) + newEntry + content.slice(insertPos);

	// Update the last-updated footer
	const today = new Date().toISOString().slice(0, 10);
	content = content.replace(
		/\*Last updated:.*\*/,
		`*Last updated: ${today}*`,
	);

	writeFileSync(MEMORY_PATH, content, "utf-8");
}
