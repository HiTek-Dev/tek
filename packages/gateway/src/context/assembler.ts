import type { ModelMessage } from "ai";
import { estimateTokenCount } from "tokenx";
import {
	loadConfig,
	discoverSkills,
	getSkillsDirs,
	formatSkillsForContext,
} from "@tek/core";
import type { MessageRow } from "../session/types.js";
import { getModelPricing } from "../usage/pricing.js";
import type { ContextSection, AssembledContext } from "./types.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { ThreadManager } from "../memory/thread-manager.js";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

/** Lazy-init singleton instances (matches SessionManager/UsageTracker pattern) */
let memoryManagerInstance: MemoryManager | null = null;
let threadManagerInstance: ThreadManager | null = null;

function getMemoryManager(): MemoryManager {
	if (!memoryManagerInstance) {
		memoryManagerInstance = new MemoryManager();
	}
	return memoryManagerInstance;
}

function getThreadManager(): ThreadManager {
	if (!threadManagerInstance) {
		threadManagerInstance = new ThreadManager();
	}
	return threadManagerInstance;
}

/**
 * Add a measured section to the sections array.
 */
function addSection(
	sections: ContextSection[],
	name: string,
	content: string,
	inputPerMTok: number,
): void {
	const byteCount = Buffer.byteLength(content, "utf8");
	const tokenEstimate = content.length > 0 ? estimateTokenCount(content) : 0;
	const costEstimate = (tokenEstimate / 1_000_000) * inputPerMTok;
	sections.push({ name, content, byteCount, tokenEstimate, costEstimate });
}

/**
 * Assemble context from session messages and user message for an LLM call.
 * Builds measured sections and constructs the ModelMessage[] array for AI SDK.
 *
 * Injects SOUL.md personality, MEMORY.md facts, and recent daily logs
 * into the system prompt for every LLM call.
 */
export function assembleContext(
	sessionMessages: MessageRow[],
	userMessage: string,
	model: string,
	threadId?: string,
	toolDescriptions?: string,
): AssembledContext {
	const pricing = getModelPricing(model);
	const sections: ContextSection[] = [];

	// Build user/global system prompt from thread manager
	const threadManager = getThreadManager();
	const userSystemPrompt = threadManager.buildSystemPrompt(threadId) || DEFAULT_SYSTEM_PROMPT;

	// Load memory context (soul, long-term memory, daily logs)
	const memoryManager = getMemoryManager();
	const memoryCtx = memoryManager.getMemoryContext();

	// Compose full system prompt: user prompt + soul + memory + recent logs
	const systemParts = [
		userSystemPrompt,
		memoryCtx.soul ? `\n\n# Your Identity\n${memoryCtx.soul}` : "",
		memoryCtx.longTermMemory ? `\n\n# Long-Term Memory\n${memoryCtx.longTermMemory}` : "",
		memoryCtx.recentLogs ? `\n\n# Recent Activity\n${memoryCtx.recentLogs}` : "",
	].filter(Boolean).join("");

	// Measured sections for context inspection
	addSection(sections, "system_prompt", userSystemPrompt, pricing.inputPerMTok);
	addSection(sections, "soul", memoryCtx.soul, pricing.inputPerMTok);
	addSection(sections, "long_term_memory", memoryCtx.longTermMemory, pricing.inputPerMTok);
	addSection(sections, "recent_activity", memoryCtx.recentLogs, pricing.inputPerMTok);

	// History: format prior messages
	const historyText = sessionMessages
		.map((m) => `${m.role}: ${m.content}`)
		.join("\n");
	addSection(sections, "history", historyText, pricing.inputPerMTok);

	// Skills: discover and format SKILL.md files from workspace and managed dirs
	let skillsContent = "";
	try {
		const config = loadConfig();
		if (config) {
			const skillsDirs = getSkillsDirs({
				workspaceDir: config.workspaceDir,
				skillsDir: config.skillsDir,
			});
			const skills = discoverSkills(skillsDirs);
			skillsContent = formatSkillsForContext(skills);
		}
	} catch {
		// Skills loading is best-effort; continue with empty skills
	}
	addSection(sections, "skills", skillsContent, pricing.inputPerMTok);

	// Tools: tool descriptions passed from handler (from tool registry)
	addSection(sections, "tools", toolDescriptions ?? "", pricing.inputPerMTok);

	// Current user message
	addSection(sections, "user_message", userMessage, pricing.inputPerMTok);

	// Build ModelMessage[] for AI SDK from session history + current message
	const messages: ModelMessage[] = [
		...sessionMessages.map(
			(m): ModelMessage => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			}),
		),
		{ role: "user", content: userMessage },
	];

	// Compute totals
	const totals = sections.reduce(
		(acc, s) => ({
			byteCount: acc.byteCount + s.byteCount,
			tokenEstimate: acc.tokenEstimate + s.tokenEstimate,
			costEstimate: acc.costEstimate + s.costEstimate,
		}),
		{ byteCount: 0, tokenEstimate: 0, costEstimate: 0 },
	);

	return { sections, totals, messages, system: systemParts };
}
