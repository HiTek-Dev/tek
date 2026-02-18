import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_DIR, CONFIG_DIR_NAME } from "@tek/core";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Path to the bundled template memory-files directory */
const TEMPLATE_DIR = resolve(__dirname, "../../memory-files");

/**
 * Ensure a memory file exists at the CONFIG_DIR location.
 *
 * Handles two scenarios:
 * 1. First install: copies template from packages/db/memory-files/ to CONFIG_DIR/memory/
 * 2. Dev-mode migration: copies from old __dirname-relative location to CONFIG_DIR/memory/
 *
 * @param subpath - Path relative to the memory directory (e.g. "SOUL.md", "MEMORY.md", "daily/")
 * @param templateFilename - Filename in the template directory (e.g. "SOUL.md", "MEMORY.md"), or null for directories
 * @returns The absolute path at the CONFIG_DIR location
 */
export function ensureMemoryFile(subpath: string, templateFilename: string | null): string {
	const targetPath = join(CONFIG_DIR, "memory", subpath);
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
		console.error(`[tek] Migrated ${templateFilename} to ~/.config/${CONFIG_DIR_NAME}/memory/`);
		return targetPath;
	}

	// No template available (deployed install without templates) -- return path anyway
	// Callers handle missing files gracefully (return empty string)
	return targetPath;
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
