import { tool } from "ai";
import { z } from "zod";
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";
import { isPathWithinWorkspace, type SecurityMode } from "@tek/core";

const MAX_READ_SIZE = 100 * 1024; // 100KB

/**
 * Resolve a path relative to the agent workspace directory.
 * Absolute paths pass through (checkWorkspace enforces security).
 * Relative paths are resolved against workspaceDir if available, else cwd.
 */
function resolveAgentPath(path: string, workspaceDir?: string): string {
	if (isAbsolute(path)) return path;
	return workspaceDir ? resolve(workspaceDir, path) : resolve(path);
}

function checkWorkspace(
	path: string,
	securityMode: SecurityMode,
	workspaceDir?: string,
): void {
	if (securityMode === "limited-control") {
		if (!workspaceDir) {
			throw new Error(
				"Workspace directory must be configured in limited-control mode",
			);
		}
		if (!isPathWithinWorkspace(path, workspaceDir)) {
			throw new Error(
				`Path '${path}' is outside the allowed workspace '${workspaceDir}'`,
			);
		}
	}
}

/**
 * Create filesystem tools (read_file, write_file, list_files) that respect security mode.
 * In limited-control mode, all paths are restricted to the workspace directory.
 */
export function createFilesystemTools(
	securityMode: SecurityMode,
	workspaceDir?: string,
) {
	const read_file = tool({
		description:
			"Read the contents of a file at the given path. Paths are relative to your workspace directory. Returns the file content as a UTF-8 string.",
		inputSchema: z.object({
			path: z.string().describe("File path to read (relative to workspace)"),
		}),
		execute: async ({ path: rawPath }) => {
			const path = resolveAgentPath(rawPath, workspaceDir);
			checkWorkspace(path, securityMode, workspaceDir);
			const content = await readFile(path, "utf-8");
			if (content.length > MAX_READ_SIZE) {
				return (
					content.slice(0, MAX_READ_SIZE) +
					`\n\n[TRUNCATED: file is ${content.length} bytes, showing first ${MAX_READ_SIZE} bytes]`
				);
			}
			return content;
		},
	});

	const write_file = tool({
		description:
			"Write content to a file at the given path. Paths are relative to your workspace directory. Creates the file if it does not exist, overwrites if it does.",
		inputSchema: z.object({
			path: z.string().describe("File path to write (relative to workspace)"),
			content: z.string().describe("Content to write to the file"),
		}),
		execute: async ({ path: rawPath, content }) => {
			const path = resolveAgentPath(rawPath, workspaceDir);
			checkWorkspace(path, securityMode, workspaceDir);
			await writeFile(path, content, "utf-8");
			return `Wrote ${Buffer.byteLength(content, "utf-8")} bytes to ${path}`;
		},
	});

	const list_files = tool({
		description:
			"List files and directories at the given path. Paths are relative to your workspace directory. Optionally list recursively.",
		inputSchema: z.object({
			directory: z
				.string()
				.describe("Directory path to list (relative to workspace)"),
			recursive: z
				.boolean()
				.optional()
				.describe("If true, list files recursively"),
		}),
		execute: async ({ directory: rawDirectory, recursive }) => {
			const directory = resolveAgentPath(rawDirectory, workspaceDir);
			checkWorkspace(directory, securityMode, workspaceDir);

			if (recursive) {
				const entries = await readdir(directory, {
					recursive: true,
					withFileTypes: true,
				});
				return entries
					.map((e) => {
						const rel = e.parentPath
							? join(e.parentPath, e.name)
							: e.name;
						return `${e.isDirectory() ? "d" : "f"} ${rel}`;
					})
					.join("\n");
			}

			const entries = await readdir(directory, { withFileTypes: true });
			return entries
				.map((e) => `${e.isDirectory() ? "d" : "f"} ${e.name}`)
				.join("\n");
		},
	});

	const delete_file = tool({
		description:
			"Delete a file at the given path. Paths are relative to your workspace directory.",
		inputSchema: z.object({
			path: z.string().describe("File path to delete (relative to workspace)"),
		}),
		execute: async ({ path: rawPath }) => {
			const path = resolveAgentPath(rawPath, workspaceDir);
			checkWorkspace(path, securityMode, workspaceDir);
			await unlink(path);
			return `Deleted ${path}`;
		},
	});

	return { read_file, write_file, list_files, delete_file };
}
