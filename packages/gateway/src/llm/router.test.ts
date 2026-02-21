import { describe, expect, it, vi } from "vitest";

vi.mock("./registry.js", () => ({
	getAvailableProviders: vi.fn(() => ["anthropic", "ollama"]),
}));

import { classifyComplexity, getAlternatives, routeMessage } from "./router.js";
import { getAvailableProviders } from "./registry.js";
import type { RoutingRule } from "./types.js";

const mockedGetAvailableProviders = vi.mocked(getAvailableProviders);

// ── classifyComplexity ──────────────────────────────────────────────

describe("classifyComplexity", () => {
	describe("high tier — keyword match", () => {
		const keywords = [
			"analyze",
			"design",
			"refactor",
			"plan",
			"architect",
			"compare",
			"evaluate",
		];

		for (const kw of keywords) {
			it(`returns high tier with confidence 1.0 for keyword "${kw}"`, () => {
				const result = classifyComplexity(`Please ${kw} this code`, 0);
				expect(result).toEqual({ tier: "high", confidence: 1.0 });
			});
		}
	});

	describe("high tier — message length", () => {
		it("returns high tier with confidence 0.7 for messages over 2000 chars", () => {
			const longMessage = "a".repeat(2001);
			const result = classifyComplexity(longMessage, 0);
			expect(result).toEqual({ tier: "high", confidence: 0.7 });
		});
	});

	describe("high tier — history length", () => {
		it("returns high tier with confidence 0.7 for historyLength > 20", () => {
			const result = classifyComplexity("short message", 25);
			expect(result).toEqual({ tier: "high", confidence: 0.7 });
		});
	});

	describe("budget tier — with default rules, standard catches before budget", () => {
		// DEFAULT_RULES: high=1, standard=2, budget=3. Since standard match is () => true,
		// standard (priority 2) always matches before budget (priority 3).
		// Budget tier only wins when rules are re-ordered or custom.
		const budgetKeywords = ["hi", "thanks", "hello", "yes"];

		for (const kw of budgetKeywords) {
			it(`"${kw}" falls to standard because standard (priority 2) matches before budget (priority 3)`, () => {
				const result = classifyComplexity(kw, 0);
				expect(result).toEqual({ tier: "standard", confidence: 0.5 });
			});
		}

		it("budget tier matches when rules give it higher priority than standard", () => {
			const budgetFirstRules: RoutingRule[] = [
				{
					tier: "budget",
					priority: 1,
					match: (msg: string, hist: number) => {
						const simplePattern = /\b(hi|hello|thanks|yes)\b/i;
						return simplePattern.test(msg) && msg.length < 200 && hist < 5;
					},
				},
				{
					tier: "standard",
					priority: 2,
					match: () => true,
				},
			];
			const result = classifyComplexity("hi", 0, budgetFirstRules);
			expect(result).toEqual({ tier: "budget", confidence: 1.0 });
		});
	});

	describe("budget NOT matched when conditions fail (custom rules)", () => {
		const budgetFirstRules: RoutingRule[] = [
			{
				tier: "budget",
				priority: 1,
				match: (msg: string, hist: number) => {
					const simplePattern = /\b(hi|hello|thanks|yes)\b/i;
					return simplePattern.test(msg) && msg.length < 200 && hist < 5;
				},
			},
			{
				tier: "standard",
				priority: 2,
				match: () => true,
			},
		];

		it("falls to standard when message is too long despite budget keyword", () => {
			const longHi = "hi ".repeat(100); // >200 chars
			const result = classifyComplexity(longHi, 0, budgetFirstRules);
			expect(result.tier).toBe("standard");
		});

		it("falls to standard when historyLength >= 5 despite budget keyword", () => {
			const result = classifyComplexity("hi", 10, budgetFirstRules);
			expect(result.tier).toBe("standard");
		});
	});

	describe("standard tier — default fallback", () => {
		it("returns standard tier with confidence 0.5 for unmatched messages", () => {
			const result = classifyComplexity("tell me about cats", 5);
			expect(result).toEqual({ tier: "standard", confidence: 0.5 });
		});
	});

	describe("custom rules", () => {
		it("uses custom rules instead of defaults", () => {
			const customRules: RoutingRule[] = [
				{
					tier: "budget",
					priority: 1,
					match: (msg: string) => msg.includes("custom-trigger"),
				},
				{
					tier: "standard",
					priority: 2,
					match: () => true,
				},
			];

			const result = classifyComplexity("custom-trigger please", 0, customRules);
			expect(result.tier).toBe("budget");
		});
	});
});

// ── routeMessage ────────────────────────────────────────────────────

describe("routeMessage", () => {
	it("returns preferred provider when available", () => {
		mockedGetAvailableProviders.mockReturnValue(["anthropic"]);
		const result = routeMessage("analyze this", 0);
		expect(result.provider).toBe("anthropic");
		expect(result.tier).toBe("high");
	});

	it("falls back to available provider when preferred is unavailable", () => {
		// Default tiers all use "anthropic:" prefix. Mock only "openai" available.
		mockedGetAvailableProviders.mockReturnValue(["openai"]);
		const result = routeMessage("analyze this", 0, {
			tiers: {
				high: "anthropic:claude-sonnet-4-5-20250929",
				standard: "openai:gpt-4o",
				budget: "anthropic:claude-haiku-4-5-20250929",
			},
		});
		// Should fall back to openai (standard tier has openai)
		expect(result.provider).toBe("openai");
		expect(result.confidence).toBeLessThan(1.0);
		expect(result.reason).toContain("Fallback");
	});

	it("returns original decision as last resort when no provider available", () => {
		mockedGetAvailableProviders.mockReturnValue([]);
		const result = routeMessage("analyze this", 0);
		expect(result.tier).toBe("high");
		expect(result.provider).toBe("anthropic");
	});
});

// ── getAlternatives ─────────────────────────────────────────────────

describe("getAlternatives", () => {
	it("returns non-selected tiers with different model IDs", () => {
		const decision = {
			tier: "standard" as const,
			provider: "anthropic",
			model: "claude-sonnet-4-5-20250929",
			reason: "Default routing",
			confidence: 0.5,
		};

		const tiers = {
			high: "anthropic:claude-sonnet-4-5-20250929",
			standard: "anthropic:claude-sonnet-4-5-20250929",
			budget: "anthropic:claude-haiku-4-5-20250929",
		};

		const alts = getAlternatives(decision, tiers);
		// high has same model ID as standard (already seen), so only budget returned
		expect(alts).toHaveLength(1);
		expect(alts[0]).toEqual({
			provider: "anthropic",
			model: "claude-haiku-4-5-20250929",
			tier: "budget",
		});
	});

	it("returns multiple alternatives when all tiers use different models", () => {
		const decision = {
			tier: "standard" as const,
			provider: "openai",
			model: "gpt-4o",
			reason: "Default routing",
			confidence: 0.5,
		};

		const tiers = {
			high: "anthropic:claude-sonnet-4-5-20250929",
			standard: "openai:gpt-4o",
			budget: "anthropic:claude-haiku-4-5-20250929",
		};

		const alts = getAlternatives(decision, tiers);
		expect(alts).toHaveLength(2);
		expect(alts.map((a) => a.tier)).toContain("high");
		expect(alts.map((a) => a.tier)).toContain("budget");
	});
});
