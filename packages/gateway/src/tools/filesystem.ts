import { tool } from "ai";
import { z } from "zod";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { isPathWithinWorkspace, type SecurityMode } from "@agentspace/core";

const MAX_READ_SIZE = 100 * 1024; // 100KB

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
			"Read the contents of a file at the given path. Returns the file content as a UTF-8 string.",
		inputSchema: z.object({
			path: z.string().describe("Absolute or relative file path to read"),
		}),
		execute: async ({ path }) => {
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
			"Write content to a file at the given path. Creates the file if it does not exist, overwrites if it does.",
		inputSchema: z.object({
			path: z.string().describe("Absolute or relative file path to write"),
			content: z.string().describe("Content to write to the file"),
		}),
		execute: async ({ path, content }) => {
			checkWorkspace(path, securityMode, workspaceDir);
			await writeFile(path, content, "utf-8");
			return `Wrote ${Buffer.byteLength(content, "utf-8")} bytes to ${path}`;
		},
	});

	const list_files = tool({
		description:
			"List files and directories at the given path. Optionally list recursively.",
		inputSchema: z.object({
			directory: z
				.string()
				.describe("Directory path to list"),
			recursive: z
				.boolean()
				.optional()
				.describe("If true, list files recursively"),
		}),
		execute: async ({ directory, recursive }) => {
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

	return { read_file, write_file, list_files };
}
