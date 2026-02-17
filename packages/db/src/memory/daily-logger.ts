import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "@agentspace/core";

/** Directory for daily log markdown files */
const MEMORY_DIR = join(CONFIG_DIR, "memory", "daily");

/**
 * Get the path to today's daily log file (YYYY-MM-DD.md).
 */
export function getTodayLogPath(): string {
	const today = new Date().toISOString().slice(0, 10);
	return join(MEMORY_DIR, `${today}.md`);
}

/**
 * Get the path to yesterday's daily log file.
 */
export function getYesterdayLogPath(): string {
	const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
	return join(MEMORY_DIR, `${yesterday}.md`);
}

/**
 * Append a timestamped entry to today's daily log file.
 * Creates the file and directory if they don't exist.
 */
export function appendDailyLog(content: string): void {
	mkdirSync(MEMORY_DIR, { recursive: true });
	const logPath = getTodayLogPath();
	const timestamp = new Date().toISOString();
	const entry = `## ${timestamp}\n\n${content}\n\n`;
	appendFileSync(logPath, entry, "utf-8");
}

/**
 * Load today's and yesterday's daily logs joined with a separator.
 * Returns empty string if neither file exists.
 */
export function loadRecentLogs(): string {
	const parts: string[] = [];

	const yesterdayPath = getYesterdayLogPath();
	if (existsSync(yesterdayPath)) {
		parts.push(readFileSync(yesterdayPath, "utf-8"));
	}

	const todayPath = getTodayLogPath();
	if (existsSync(todayPath)) {
		parts.push(readFileSync(todayPath, "utf-8"));
	}

	return parts.join("\n---\n");
}
