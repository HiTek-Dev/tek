import { tool } from "ai";
import { z } from "zod";
import {
	loadSoul,
	loadIdentity,
	loadStyle,
	loadUser,
	loadLongTermMemory,
	loadRecentLogs,
	addMemoryEntry,
	appendDailyLog,
	updateIdentityFileSection,
} from "@tek/db";
import type { MemorySection } from "@tek/db";

const VALID_MEMORY_SECTIONS: MemorySection[] = [
	"User Facts",
	"Project Context",
	"Preferences",
	"Important Decisions",
];

const VALID_IDENTITY_FILES = [
	"SOUL.md",
	"IDENTITY.md",
	"STYLE.md",
	"USER.md",
] as const;

/**
 * Create a memory_read tool that reads identity and memory files.
 * Bypasses workspace restrictions — accesses ~/.config/tek/memory/ directly via @tek/db.
 */
export function createMemoryReadTool(agentId?: string) {
	return tool({
		description:
			"Read one of your identity or memory files. Available files: SOUL.md (your personality), IDENTITY.md (your traits), STYLE.md (communication style), USER.md (user context), MEMORY.md (long-term memory), DAILY_LOGS (recent daily logs)",
		inputSchema: z.object({
			file: z.enum([
				"SOUL.md",
				"IDENTITY.md",
				"STYLE.md",
				"USER.md",
				"MEMORY.md",
				"DAILY_LOGS",
			]),
		}),
		execute: async ({ file }) => {
			let content: string;

			switch (file) {
				case "SOUL.md":
					content = loadSoul(agentId);
					break;
				case "IDENTITY.md":
					content = loadIdentity(agentId);
					break;
				case "STYLE.md":
					content = loadStyle(agentId);
					break;
				case "USER.md":
					content = loadUser();
					break;
				case "MEMORY.md":
					content = loadLongTermMemory();
					break;
				case "DAILY_LOGS":
					content = loadRecentLogs();
					break;
				default:
					return `Unknown file: ${file}`;
			}

			return content || "(empty)";
		},
	});
}

/**
 * Create a memory_write tool that writes to memory and identity files.
 * Bypasses workspace restrictions — accesses ~/.config/tek/memory/ directly via @tek/db.
 */
export function createMemoryWriteTool() {
	return tool({
		description:
			"Write to your memory or identity files. Use 'memory' to add facts to MEMORY.md, 'daily' to append to today's log, 'identity' to update a section in an identity file.",
		inputSchema: z.object({
			target: z.enum(["memory", "daily", "identity"]),
			content: z.string().describe("The content to write"),
			section: z
				.string()
				.optional()
				.describe(
					"Section name (for memory: 'User Facts', 'Project Context', 'Preferences', 'Important Decisions'; for identity: section heading)",
				),
			file: z
				.string()
				.optional()
				.describe(
					"Identity file name (SOUL.md, IDENTITY.md, STYLE.md, USER.md) — only used with target 'identity'",
				),
		}),
		execute: async ({ target, content, section, file }) => {
			switch (target) {
				case "memory": {
					const memorySection = (section || "User Facts") as MemorySection;
					if (
						!VALID_MEMORY_SECTIONS.includes(memorySection)
					) {
						return `Invalid memory section '${memorySection}'. Valid sections: ${VALID_MEMORY_SECTIONS.join(", ")}`;
					}
					addMemoryEntry(memorySection, content);
					return `Added entry to MEMORY.md section '${memorySection}'`;
				}

				case "daily": {
					appendDailyLog(content);
					return "Appended to today's daily log";
				}

				case "identity": {
					const identityFile = (file || "SOUL.md") as (typeof VALID_IDENTITY_FILES)[number];
					if (
						!VALID_IDENTITY_FILES.includes(identityFile)
					) {
						return `Invalid identity file '${identityFile}'. Valid files: ${VALID_IDENTITY_FILES.join(", ")}`;
					}
					const identitySection = section || "Learned Preferences";
					updateIdentityFileSection(
						identityFile,
						identitySection,
						content,
					);
					return `Updated section '${identitySection}' in ${identityFile}`;
				}

				default:
					return `Unknown target: ${target}`;
			}
		},
	});
}
