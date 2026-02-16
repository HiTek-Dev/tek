import { getAvailableProviders } from "./registry.js";
import { DEFAULT_RULES, DEFAULT_TIERS } from "./router-rules.js";
import type {
	ModelTier,
	RoutingDecision,
	RoutingRule,
	TierConfig,
} from "./types.js";

/**
 * Classify message complexity into a model tier.
 *
 * Evaluates rules in priority order (ascending). First match wins.
 * Returns the matched tier and a confidence score:
 * - 1.0 for explicit keyword match (high/budget with keyword)
 * - 0.7 for length/history-based match
 * - 0.5 for default fallback (standard)
 */
export function classifyComplexity(
	message: string,
	historyLength: number,
	rules?: RoutingRule[],
): { tier: ModelTier; confidence: number } {
	const activeRules = [...(rules ?? DEFAULT_RULES)].sort(
		(a, b) => a.priority - b.priority,
	);

	for (const rule of activeRules) {
		if (rule.match(message, historyLength)) {
			let confidence: number;

			if (rule.tier === "standard" && rule.priority === 2) {
				// Default fallback
				confidence = 0.5;
			} else if (rule.tier === "high") {
				// Determine if keyword or length/history based
				const complexPattern =
					/\b(plan|architect|design|analyze|compare|evaluate|debug complex|refactor|explain in detail|write a comprehensive)\b/i;
				confidence = complexPattern.test(message) ? 1.0 : 0.7;
			} else if (rule.tier === "budget") {
				confidence = 1.0; // Budget always matches via keyword
			} else {
				confidence = 0.5;
			}

			return { tier: rule.tier, confidence };
		}
	}

	// Should never reach here with DEFAULT_RULES (standard always matches)
	return { tier: "standard", confidence: 0.5 };
}

/**
 * Build a human-readable reason string for a routing decision.
 */
function buildReason(
	tier: ModelTier,
	message: string,
	historyLength: number,
): string {
	if (tier === "high") {
		const complexPattern =
			/\b(plan|architect|design|analyze|compare|evaluate|debug complex|refactor|explain in detail|write a comprehensive)\b/i;
		const match = message.match(complexPattern);
		if (match) {
			return `Complex task detected (keyword: '${match[0].toLowerCase()}')`;
		}
		if (message.length > 2000) {
			return `Complex task detected (message length: ${message.length} chars)`;
		}
		if (historyLength > 20) {
			return `Complex task detected (long conversation: ${historyLength} messages)`;
		}
	}

	if (tier === "budget") {
		const simplePattern =
			/\b(hi|hello|hey|thanks|thank you|what is|define|translate|summarize briefly|yes|no|ok|sure)\b/i;
		const match = message.match(simplePattern);
		if (match) {
			return `Simple greeting/response (keyword: '${match[0].toLowerCase()}')`;
		}
	}

	return "Default routing";
}

/**
 * Route a message to the appropriate model based on complexity classification.
 *
 * Checks provider availability and falls back to other tiers or the first
 * available provider if the preferred one is not configured.
 */
export function routeMessage(
	message: string,
	historyLength: number,
	opts?: { tiers?: TierConfig; rules?: RoutingRule[] },
): RoutingDecision {
	const tiers = opts?.tiers ?? DEFAULT_TIERS;
	const { tier, confidence } = classifyComplexity(
		message,
		historyLength,
		opts?.rules,
	);

	const modelId = tiers[tier];
	const [provider, ...modelParts] = modelId.split(":");
	const model = modelParts.join(":");
	const available = getAvailableProviders();

	// Check if the preferred provider is available
	if (available.includes(provider)) {
		return {
			tier,
			provider,
			model,
			reason: buildReason(tier, message, historyLength),
			confidence,
		};
	}

	// Fallback: try other tiers that have available providers
	const tierOrder: ModelTier[] = ["standard", "high", "budget"];
	for (const fallbackTier of tierOrder) {
		if (fallbackTier === tier) continue;
		const fallbackModelId = tiers[fallbackTier];
		const [fbProvider, ...fbModelParts] = fallbackModelId.split(":");
		const fbModel = fbModelParts.join(":");
		if (available.includes(fbProvider)) {
			return {
				tier: fallbackTier,
				provider: fbProvider,
				model: fbModel,
				reason: `Fallback: preferred provider '${provider}' unavailable, using ${fbProvider}`,
				confidence: confidence * 0.8,
			};
		}
	}

	// Last resort: return original decision even if provider unavailable
	// (will error at streaming time with a clear message)
	return {
		tier,
		provider,
		model,
		reason: buildReason(tier, message, historyLength),
		confidence,
	};
}

/**
 * Get alternative model options not selected by the routing decision.
 * Used in manual mode to present options in the proposal message.
 */
export function getAlternatives(
	decision: RoutingDecision,
	tiers?: TierConfig,
): Array<{ provider: string; model: string; tier: ModelTier }> {
	const activeTiers = tiers ?? DEFAULT_TIERS;
	const allTiers: ModelTier[] = ["high", "standard", "budget"];
	const alternatives: Array<{
		provider: string;
		model: string;
		tier: ModelTier;
	}> = [];

	const seen = new Set<string>();
	seen.add(`${decision.provider}:${decision.model}`);

	for (const t of allTiers) {
		const modelId = activeTiers[t];
		if (seen.has(modelId)) continue;
		seen.add(modelId);

		const [provider, ...modelParts] = modelId.split(":");
		const model = modelParts.join(":");
		alternatives.push({ provider, model, tier: t });
	}

	return alternatives;
}
