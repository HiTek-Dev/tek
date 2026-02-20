import { tool } from "ai";
import { z } from "zod";
import { execaCommand } from "execa";
import { resolve, isAbsolute } from "node:path";
import type { SecurityMode } from "@tek/core";

/**
 * Resolve a path relative to the agent workspace directory.
 */
function resolveAgentPath(path: string, workspaceDir?: string): string {
	if (isAbsolute(path)) return path;
	return workspaceDir ? resolve(workspaceDir, path) : resolve(path);
}

const MAX_OUTPUT_SIZE = 50 * 1024; // 50KB per stream

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return (
		text.slice(0, max) +
		`\n\n[TRUNCATED: output is ${text.length} chars, showing first ${max}]`
	);
}

/**
 * Create a shell execution tool with security mode enforcement.
 * In limited-control mode, cwd is forced to workspaceDir.
 */
export function createShellTool(
	securityMode: SecurityMode,
	workspaceDir?: string,
) {
	return tool({
		description:
			"Execute a shell command and return its output. Commands run in your workspace directory by default. Use for running build commands, git operations, or other CLI tools.",
		inputSchema: z.object({
			command: z.string().describe("The shell command to execute"),
			cwd: z
				.string()
				.optional()
				.describe("Working directory for the command (relative to workspace)"),
			timeout: z
				.number()
				.optional()
				.default(30000)
				.describe("Timeout in milliseconds (default 30000)"),
		}),
		execute: async ({ command, cwd, timeout }) => {
			// In limited-control mode, force cwd to workspace
			let effectiveCwd: string | undefined;
			if (securityMode === "limited-control") {
				if (!workspaceDir) {
					throw new Error(
						"Workspace directory must be configured in limited-control mode",
					);
				}
				effectiveCwd = workspaceDir;
			} else {
				// Resolve relative cwd against workspace, default to workspace
				effectiveCwd = cwd
					? resolveAgentPath(cwd, workspaceDir)
					: workspaceDir;
			}

			const result = await execaCommand(command, {
				cwd: effectiveCwd,
				timeout,
				reject: false,
			});

			return {
				stdout: truncate(result.stdout, MAX_OUTPUT_SIZE),
				stderr: truncate(result.stderr, MAX_OUTPUT_SIZE),
				exitCode: result.exitCode,
				failed: result.failed,
			};
		},
	});
}
