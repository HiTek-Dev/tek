import type { CanUseTool, PermissionMode } from "@anthropic-ai/claude-agent-sdk";

// ── Session Status ────────────────────────────────────────────────────

export type ClaudeCodeSessionStatus =
	| "spawning"
	| "running"
	| "waiting-approval"
	| "completed"
	| "error"
	| "aborted";

// ── Session ───────────────────────────────────────────────────────────

export interface ClaudeCodeSession {
	/** Unique session identifier */
	id: string;
	/** Current lifecycle status */
	status: ClaudeCodeSessionStatus;
	/** Controller for aborting the session */
	abortController: AbortController;
	/** Original prompt that spawned the session */
	prompt: string;
	/** Working directory for the session */
	cwd: string;
	/** When the session was created */
	createdAt: Date;
	/** When the session completed (success, error, or abort) */
	completedAt?: Date;
	/** Total cost in USD reported by the SDK result */
	totalCostUsd?: number;
}

// ── Spawn Options ─────────────────────────────────────────────────────

export interface SpawnSessionOptions {
	/** The prompt / task to send to Claude Code */
	prompt: string;
	/** Working directory for the session */
	cwd: string;
	/** Tools that are auto-allowed without prompting */
	allowedTools?: string[];
	/** Permission mode for the session */
	permissionMode?: PermissionMode;
	/** Maximum conversation turns before stopping */
	maxTurns?: number;
	/** Custom permission handler for tool approval proxying */
	canUseTool?: CanUseTool;
}
