import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "@tek/core";
import { ensureMemoryFile } from "./ensure-memory.js";
import { resolveIdentityFile } from "./agent-resolver.js";

/** Path to the identity document */
const IDENTITY_PATH = join(CONFIG_DIR, "memory", "IDENTITY.md");

/** Path to the style guide document */
const STYLE_PATH = join(CONFIG_DIR, "memory", "STYLE.md");

/** Path to the user context document */
const USER_PATH = join(CONFIG_DIR, "memory", "USER.md");

/** Path to the agents configuration document */
const AGENTS_PATH = join(CONFIG_DIR, "memory", "AGENTS.md");

/**
 * Load the contents of IDENTITY.md.
 * When agentId is provided, uses cascade resolution (agent-specific > shared > global).
 * Seeds from template on first run for global path.
 * Returns empty string if the file doesn't exist and no template is available.
 */
export function loadIdentity(agentId?: string): string {
	if (agentId) {
		const content = resolveIdentityFile(agentId, "IDENTITY.md");
		if (content) return content;
	}
	// Fallback to global (seeds template if needed)
	ensureMemoryFile("IDENTITY.md", "IDENTITY.md");
	if (!existsSync(IDENTITY_PATH)) return "";
	return readFileSync(IDENTITY_PATH, "utf-8");
}

/**
 * Load the contents of STYLE.md.
 * When agentId is provided, uses cascade resolution (agent-specific > shared > global).
 * Seeds from template on first run for global path.
 * Returns empty string if the file doesn't exist and no template is available.
 */
export function loadStyle(agentId?: string): string {
	if (agentId) {
		const content = resolveIdentityFile(agentId, "STYLE.md");
		if (content) return content;
	}
	// Fallback to global (seeds template if needed)
	ensureMemoryFile("STYLE.md", "STYLE.md");
	if (!existsSync(STYLE_PATH)) return "";
	return readFileSync(STYLE_PATH, "utf-8");
}

/**
 * Load the contents of USER.md.
 * When agentId is provided, uses cascade resolution (agent-specific > shared > global).
 * Otherwise loads from global (shared across all agents).
 * Seeds from template on first run.
 * Returns empty string if the file doesn't exist and no template is available.
 */
export function loadUser(agentId?: string): string {
	if (agentId) {
		const content = resolveIdentityFile(agentId, "USER.md");
		if (content) return content;
	}
	ensureMemoryFile("USER.md", "USER.md");
	if (!existsSync(USER_PATH)) return "";
	return readFileSync(USER_PATH, "utf-8");
}

/**
 * Load the contents of AGENTS.md.
 * Always loads from global (coordination config is not per-agent).
 * Seeds from template on first run.
 * Returns empty string if the file doesn't exist and no template is available.
 */
export function loadAgentsConfig(): string {
	ensureMemoryFile("AGENTS.md", "AGENTS.md");
	if (!existsSync(AGENTS_PATH)) return "";
	return readFileSync(AGENTS_PATH, "utf-8");
}
