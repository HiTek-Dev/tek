import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "@tek/core";

/** Base directory for per-agent identity files */
export const AGENTS_DIR = join(CONFIG_DIR, "agents");

/** Shared identity files (e.g., USER.md) used across all agents */
const SHARED_DIR = join(AGENTS_DIR, "shared");

/** Global memory directory (backward-compatible, single-agent default) */
const GLOBAL_MEMORY_DIR = join(CONFIG_DIR, "memory");

/**
 * Resolve an identity file using cascade resolution:
 * 1. Agent-specific: ~/.config/tek/agents/{agentId}/{filename}
 * 2. Shared: ~/.config/tek/agents/shared/{filename}
 * 3. Global: ~/.config/tek/memory/{filename} (backward-compatible)
 * 4. Empty string (file not found anywhere)
 *
 * For single-agent setups (no agentId), skips step 1 and falls through
 * to shared/global, which means the existing memory/ directory works unchanged.
 */
export function resolveIdentityFile(
	agentId: string | undefined,
	filename: string,
): string {
	// 1. Agent-specific
	if (agentId) {
		const agentPath = join(AGENTS_DIR, agentId, filename);
		if (existsSync(agentPath)) return readFileSync(agentPath, "utf-8");
	}

	// 2. Shared (for USER.md and other cross-agent files)
	const sharedPath = join(SHARED_DIR, filename);
	if (existsSync(sharedPath)) return readFileSync(sharedPath, "utf-8");

	// 3. Global memory directory (backward-compatible)
	const globalPath = join(GLOBAL_MEMORY_DIR, filename);
	if (existsSync(globalPath)) return readFileSync(globalPath, "utf-8");

	return "";
}

/**
 * Get the directory path for a specific agent's identity files.
 * Creates the directory if it doesn't exist (lazy creation).
 * Returns the global memory directory when no agentId is provided.
 */
export function resolveAgentDir(agentId?: string): string {
	if (!agentId) {
		return GLOBAL_MEMORY_DIR;
	}
	const agentDir = join(AGENTS_DIR, agentId);
	if (!existsSync(agentDir)) {
		mkdirSync(agentDir, { recursive: true });
	}
	return agentDir;
}
