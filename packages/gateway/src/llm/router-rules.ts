import type { RoutingRule, TierConfig } from "./types.js";

/**
 * Default routing rules for complexity classification.
 * Rules are evaluated in priority order (ascending); first match wins.
 */
export const DEFAULT_RULES: RoutingRule[] = [
	{
		tier: "high",
		priority: 1,
		match: (message: string, historyLength: number): boolean => {
			const complexPattern =
				/\b(plan|architect|design|analyze|compare|evaluate|debug complex|refactor|explain in detail|write a comprehensive)\b/i;
			if (complexPattern.test(message)) return true;
			if (message.length > 2000) return true;
			if (historyLength > 20) return true;
			return false;
		},
	},
	{
		tier: "budget",
		priority: 3,
		match: (message: string, historyLength: number): boolean => {
			const simplePattern =
				/\b(hi|hello|hey|thanks|thank you|what is|define|translate|summarize briefly|yes|no|ok|sure)\b/i;
			return (
				simplePattern.test(message) &&
				message.length < 200 &&
				historyLength < 5
			);
		},
	},
	{
		tier: "standard",
		priority: 2,
		match: (): boolean => true, // default fallback
	},
];

/**
 * Default tier-to-model mapping.
 * Uses provider-qualified model IDs.
 */
export const DEFAULT_TIERS: TierConfig = {
	high: "anthropic:claude-sonnet-4-5-20250929",
	standard: "anthropic:claude-sonnet-4-5-20250929",
	budget: "anthropic:claude-haiku-4-5-20250929",
};
