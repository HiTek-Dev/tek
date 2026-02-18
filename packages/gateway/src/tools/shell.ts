import { tool } from "ai";
import { z } from "zod";
import { execaCommand } from "execa";
import type { SecurityMode } from "@tek/core";

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
			"Execute a shell command and return its output. Use for running build commands, git operations, or other CLI tools.",
		inputSchema: z.object({
			command: z.string().describe("The shell command to execute"),
			cwd: z
				.string()
				.optional()
				.describe("Working directory for the command"),
			timeout: z
				.number()
				.optional()
				.default(30000)
				.describe("Timeout in milliseconds (default 30000)"),
		}),
		execute: async ({ command, cwd, timeout }) => {
			// In limited-control mode, force cwd to workspace
			let effectiveCwd = cwd;
			if (securityMode === "limited-control") {
				if (!workspaceDir) {
					throw new Error(
						"Workspace directory must be configured in limited-control mode",
					);
				}
				effectiveCwd = workspaceDir;
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
