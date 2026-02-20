import type { ModelMessage } from "ai";
import { estimateTokenCount } from "tokenx";
import {
	loadConfig,
	discoverSkills,
	getSkillsDirs,
	formatSkillsForContext,
	createLogger,
} from "@tek/core";
import type { MessageRow } from "../session/types.js";
import { getModelPricing } from "../usage/pricing.js";
import type { ContextSection, AssembledContext } from "./types.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { ThreadManager } from "../memory/thread-manager.js";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";
const logger = createLogger("assembler");

/**
 * Build the first-contact system prompt for a new agent conversation.
 * Returns the prompt with agent/user names interpolated, or empty string if config unavailable.
 */
function buildFirstContactPrompt(agentId?: string): string {
	try {
		const config = loadConfig();
		if (!config) return "";

		const agentName = agentId
			? config.agents?.list?.find((a: { id: string }) => a.id === agentId)?.name ?? "your assistant"
			: "your assistant";
		const userName = config.userDisplayName ?? "there";

		return [
			`This is your first conversation with ${userName}. Make it count.`,
			"",
			`**Your name is ${agentName}.** Introduce yourself naturally -- who you are, what you're good at, what makes you tick. Draw from your identity and personality sections above.`,
			"",
			"**Get to know them:**",
			"- What are they working on right now?",
			"- How do they prefer to communicate (brief vs detailed, casual vs formal)?",
			"- Any tools, languages, or workflows they rely on?",
			"",
			"Keep it conversational -- like meeting a sharp new colleague, not filling out a form. Listen actively and respond to what they share before asking the next thing.",
			"",
			'**Save what you learn** using the memory_write tool (target: "identity", file: "USER.md") so you remember next time. Write naturally, not as bullet points.',
		].join("\n");
	} catch {
		return "";
	}
}

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
	agentId?: string,
): AssembledContext {
	const pricing = getModelPricing(model);
	const sections: ContextSection[] = [];

	// Build user/global system prompt from thread manager
	const threadManager = getThreadManager();
	const userSystemPrompt = threadManager.buildSystemPrompt(threadId) || DEFAULT_SYSTEM_PROMPT;

	// Load memory context (soul, long-term memory, daily logs)
	const memoryManager = getMemoryManager();
	const memoryCtx = memoryManager.getMemoryContext(agentId);

	// Detect first contact: USER.md empty or sparse (< 50 chars means template-only)
	const isFirstContact = !memoryCtx.user || memoryCtx.user.trim().length < 50;
	const firstContactPrompt = isFirstContact ? buildFirstContactPrompt(agentId) : "";

	// Compose full system prompt: user prompt + identity files + memory + recent logs
	const systemParts = [
		userSystemPrompt,
		memoryCtx.soul     ? `\n\n# Your Identity\n${memoryCtx.soul}` : "",
		memoryCtx.identity ? `\n\n# Your Presentation\n${memoryCtx.identity}` : "",
		memoryCtx.style    ? `\n\n# Communication Style\n${memoryCtx.style}` : "",
		memoryCtx.user     ? `\n\n# About the User\n${memoryCtx.user}` : "",
		firstContactPrompt ? `\n\n# First Contact Instructions\n${firstContactPrompt}` : "",
		memoryCtx.agents   ? `\n\n# Agent Coordination\n${memoryCtx.agents}` : "",
		memoryCtx.longTermMemory ? `\n\n# Long-Term Memory\n${memoryCtx.longTermMemory}` : "",
		memoryCtx.recentLogs     ? `\n\n# Recent Activity\n${memoryCtx.recentLogs}` : "",
	].filter(Boolean).join("");

	// Token budget warning for identity files
	const identityTokens = [memoryCtx.soul, memoryCtx.identity, memoryCtx.style]
		.reduce((sum, content) => sum + (content ? estimateTokenCount(content) : 0), 0);
	if (identityTokens > 3000) {
		logger.warn(`Identity files exceed 3000 token budget (${identityTokens} tokens). Consider trimming SOUL.md, IDENTITY.md, or STYLE.md.`);
	}

	// Measured sections for context inspection
	addSection(sections, "system_prompt", userSystemPrompt, pricing.inputPerMTok);
	addSection(sections, "soul", memoryCtx.soul, pricing.inputPerMTok);
	addSection(sections, "identity", memoryCtx.identity, pricing.inputPerMTok);
	addSection(sections, "style", memoryCtx.style, pricing.inputPerMTok);
	addSection(sections, "user_context", memoryCtx.user, pricing.inputPerMTok);
	addSection(sections, "first_contact", firstContactPrompt, pricing.inputPerMTok);
	addSection(sections, "agents", memoryCtx.agents, pricing.inputPerMTok);
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
