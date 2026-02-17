import { tool } from "ai";
import { z } from "zod";
import type { ClaudeCodeSessionManager } from "../claude-code/session-manager.js";

/**
 * Create an AI SDK tool that spawns a Claude Code session for workflow
 * integration. The session runs headlessly with pre-approved permissions
 * (acceptEdits mode) and collects all text output.
 */
export function createClaudeCodeTool(sessionManager: ClaudeCodeSessionManager) {
	return tool({
		description:
			"Spawn a Claude Code session to perform a coding task. Claude Code can read, write, and edit files, run commands, and interact with the codebase.",
		inputSchema: z.object({
			prompt: z.string().describe("The task or prompt to send to Claude Code"),
			cwd: z
				.string()
				.optional()
				.describe("Working directory for the session (defaults to process cwd)"),
			maxTurns: z
				.number()
				.optional()
				.default(10)
				.describe("Maximum conversation turns before stopping"),
		}),
		execute: async ({ prompt, cwd, maxTurns }) => {
			try {
				const result = await sessionManager.runToCompletion(prompt, {
					cwd,
					maxTurns,
					permissionMode: "acceptEdits",
				});

				return {
					success: true as const,
					output: result.text,
					cost: result.costUsd,
				};
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : String(err);
				return {
					success: false as const,
					error: errorMessage,
				};
			}
		},
	});
}
