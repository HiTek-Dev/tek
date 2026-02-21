import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────

// Mock @tek/core
vi.mock("@tek/core", () => ({
	loadConfig: vi.fn().mockReturnValue({
		userDisplayName: "TestUser",
		agents: { list: [{ id: "default", name: "TestAgent" }] },
		workspaceDir: "/tmp/test",
		skillsDir: "/tmp/test/skills",
	}),
	discoverSkills: vi.fn().mockReturnValue([]),
	getSkillsDirs: vi.fn().mockReturnValue([]),
	formatSkillsForContext: vi.fn().mockReturnValue(""),
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

// Mock @tek/db (not directly imported by assembler, but MemoryManager/ThreadManager use it)
vi.mock("@tek/db", () => ({
	loadSoul: vi.fn(),
	loadIdentity: vi.fn(),
	loadStyle: vi.fn(),
	loadUser: vi.fn(),
	loadAgentsConfig: vi.fn(),
	loadLongTermMemory: vi.fn(),
	loadRecentLogs: vi.fn(),
	getDb: vi.fn(),
	threads: {},
	globalPrompts: {},
}));

// Mock tokenx
vi.mock("tokenx", () => ({
	estimateTokenCount: vi.fn().mockReturnValue(50),
}));

// Mock pricing
vi.mock("../usage/pricing.js", () => ({
	getModelPricing: vi.fn().mockReturnValue({ inputPerMTok: 3, outputPerMTok: 15 }),
}));

// Mock MemoryManager and ThreadManager with hoisted fn refs
const { mockGetMemoryContext, mockBuildSystemPrompt } = vi.hoisted(() => ({
	mockGetMemoryContext: vi.fn(),
	mockBuildSystemPrompt: vi.fn(),
}));

vi.mock("../memory/memory-manager.js", () => {
	return {
		MemoryManager: class {
			getMemoryContext = mockGetMemoryContext;
		},
	};
});

vi.mock("../memory/thread-manager.js", () => {
	return {
		ThreadManager: class {
			buildSystemPrompt = mockBuildSystemPrompt;
		},
	};
});

import { assembleContext } from "./assembler.js";

// ── Helpers ───────────────────────────────────────────────────────────

function defaultMemoryContext() {
	return {
		soul: "I am a creative and curious AI.",
		identity: "Friendly assistant persona.",
		style: "Concise and clear communication style.",
		user: "User prefers TypeScript and dislikes verbose responses.",
		agents: "",
		longTermMemory: "User last discussed project architecture.",
		recentLogs: "2026-02-20: Discussed testing strategies.",
	};
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("assembleContext", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetMemoryContext.mockReturnValue(defaultMemoryContext());
		mockBuildSystemPrompt.mockReturnValue("You are a helpful AI assistant.");
	});

	it("includes soul content in the system prompt", () => {
		const result = assembleContext([], "Hi there", "anthropic:claude-sonnet-4");

		expect(result.system).toContain("I am a creative and curious AI.");
	});

	it("includes identity content in the system prompt", () => {
		const result = assembleContext([], "Hi there", "anthropic:claude-sonnet-4");

		expect(result.system).toContain("Friendly assistant persona.");
	});

	it("includes memory content in the system prompt", () => {
		const result = assembleContext([], "Hi there", "anthropic:claude-sonnet-4");

		expect(result.system).toContain("User last discussed project architecture.");
	});

	it("includes style content in the system prompt", () => {
		const result = assembleContext([], "Hi there", "anthropic:claude-sonnet-4");

		expect(result.system).toContain("Concise and clear communication style.");
	});

	it("includes user context in the system prompt", () => {
		const result = assembleContext([], "Hi there", "anthropic:claude-sonnet-4");

		expect(result.system).toContain("User prefers TypeScript");
	});

	it("returns sections array with expected section names", () => {
		const result = assembleContext([], "Hi there", "anthropic:claude-sonnet-4");

		const sectionNames = result.sections.map((s) => s.name);
		expect(sectionNames).toContain("system_prompt");
		expect(sectionNames).toContain("soul");
		expect(sectionNames).toContain("identity");
		expect(sectionNames).toContain("style");
		expect(sectionNames).toContain("user_context");
		expect(sectionNames).toContain("long_term_memory");
		expect(sectionNames).toContain("recent_activity");
		expect(sectionNames).toContain("user_message");
	});

	it("sections have correct structure (byteCount, tokenEstimate, costEstimate)", () => {
		const result = assembleContext([], "Hi", "anthropic:claude-sonnet-4");

		for (const section of result.sections) {
			expect(section).toHaveProperty("name");
			expect(section).toHaveProperty("content");
			expect(section).toHaveProperty("byteCount");
			expect(section).toHaveProperty("tokenEstimate");
			expect(section).toHaveProperty("costEstimate");
			expect(typeof section.byteCount).toBe("number");
			expect(typeof section.tokenEstimate).toBe("number");
		}
	});

	it("computes totals across all sections", () => {
		const result = assembleContext([], "Hi", "anthropic:claude-sonnet-4");

		expect(result.totals.byteCount).toBeGreaterThan(0);
		expect(result.totals.tokenEstimate).toBeGreaterThan(0);
		expect(typeof result.totals.costEstimate).toBe("number");
	});

	it("handles missing optional fields without errors", () => {
		mockGetMemoryContext.mockReturnValue({
			soul: "",
			identity: "",
			style: "",
			user: "",
			agents: "",
			longTermMemory: "",
			recentLogs: "",
		});

		const result = assembleContext([], "Hi", "anthropic:claude-sonnet-4");

		// Should still return a valid context with system prompt
		expect(result.system).toBeTruthy();
		expect(result.messages.length).toBeGreaterThan(0);
		expect(result.sections.length).toBeGreaterThan(0);
	});

	it("builds messages array with session history and user message", () => {
		const history = [
			{ role: "user" as const, content: "Previous question", id: 1, sessionId: "s1", createdAt: "" },
			{ role: "assistant" as const, content: "Previous answer", id: 2, sessionId: "s1", createdAt: "" },
		];

		const result = assembleContext(
			history as any,
			"New question",
			"anthropic:claude-sonnet-4",
		);

		expect(result.messages).toHaveLength(3);
		expect(result.messages[0]).toEqual({ role: "user", content: "Previous question" });
		expect(result.messages[1]).toEqual({ role: "assistant", content: "Previous answer" });
		expect(result.messages[2]).toEqual({ role: "user", content: "New question" });
	});
});
