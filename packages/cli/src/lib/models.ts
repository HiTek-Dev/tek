/**
 * Centralized model catalog with per-provider recommendations.
 *
 * Provides a single source of truth for all known models across providers,
 * with recommendation tags and display helpers for the Onboarding wizard.
 */

import { listOllamaModels, type OllamaModel } from "@tek/core/ollama/client";

export interface ModelInfo {
	id: string;
	displayName: string;
	recommended?: "general" | "coding" | "low-cost" | "reasoning" | "premium";
	tier?: "xs" | "s" | "m" | "l";
}

/**
 * Comprehensive model catalog keyed by provider name.
 * Venice models sourced from their API; other providers use well-known model IDs.
 */
export const MODEL_CATALOG: Record<string, ModelInfo[]> = {
	venice: [
		// --- Recommendations (top of list) ---
		{ id: "minimax-m25", displayName: "MiniMax M2.5", recommended: "general", tier: "l" },
		{ id: "claude-sonnet-45", displayName: "Claude Sonnet 4.5", recommended: "premium", tier: "l" },
		{ id: "llama-3.3-70b", displayName: "Llama 3.3 70B", recommended: "low-cost", tier: "m" },
		// --- Full catalog (from docs.venice.ai/models/text) ---
		{ id: "venice-uncensored", displayName: "Venice Uncensored 1.1", tier: "s" },
		{ id: "minimax-m21", displayName: "MiniMax M2.1", tier: "l" },
		{ id: "claude-opus-4-6", displayName: "Claude Opus 4.6", tier: "l" },
		{ id: "claude-opus-45", displayName: "Claude Opus 4.5", tier: "l" },
		{ id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", tier: "l" },
		{ id: "openai-gpt-52", displayName: "GPT-5.2", tier: "l" },
		{ id: "grok-41-fast", displayName: "Grok 4.1 Fast", tier: "l" },
		{ id: "zai-org-glm-5", displayName: "GLM 5", tier: "l" },
		{ id: "zai-org-glm-4.7", displayName: "GLM 4.7", tier: "l" },
		{ id: "zai-org-glm-4.7-flash", displayName: "GLM 4.7 Flash", tier: "l" },
		{ id: "olafangensan-glm-4.7-flash-heretic", displayName: "GLM 4.7 Flash Heretic", tier: "l" },
		{ id: "kimi-k2-5", displayName: "Kimi K2.5", tier: "l" },
		{ id: "kimi-k2-thinking", displayName: "Kimi K2 Thinking", tier: "l" },
		{ id: "deepseek-v3.2", displayName: "DeepSeek V3.2", tier: "l" },
		{ id: "qwen3-next-80b", displayName: "Qwen 3 Next 80B", tier: "m" },
		{ id: "qwen3-235b-a22b-instruct-2507", displayName: "Qwen 3 235B Instruct", tier: "l" },
		{ id: "qwen3-235b-a22b-thinking-2507", displayName: "Qwen 3 235B Thinking", tier: "l" },
		{ id: "hermes-3-llama-3.1-405b", displayName: "Hermes 3 Llama 3.1 405B", tier: "l" },
		{ id: "openai-gpt-oss-120b", displayName: "OpenAI GPT OSS 120B", tier: "l" },
		{ id: "qwen3-4b", displayName: "Venice Small (Qwen3 4B)", tier: "xs" },
		{ id: "llama-3.2-3b", displayName: "Llama 3.2 3B", tier: "xs" },
	],
	anthropic: [
		{ id: "claude-sonnet-4-5-20250929", displayName: "Claude Sonnet 4.5", recommended: "general" },
		{ id: "claude-haiku-4-5-20250929", displayName: "Claude Haiku 4.5", recommended: "low-cost" },
		{ id: "claude-opus-4-5-20250929", displayName: "Claude Opus 4.5", recommended: "premium" },
	],
	openai: [
		{ id: "gpt-4o", displayName: "GPT-4o", recommended: "general" },
		{ id: "gpt-4o-mini", displayName: "GPT-4o Mini", recommended: "low-cost" },
		{ id: "o3-mini", displayName: "o3 Mini", recommended: "reasoning" },
	],
	google: [
		{ id: "gemini-2.5-pro-preview-05-06", displayName: "Gemini 2.5 Pro", recommended: "general" },
		{ id: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", recommended: "low-cost" },
	],
	ollama: [],
};

/**
 * Get models for a given provider. Returns empty array for unknown providers.
 */
export function getModelsForProvider(provider: string): ModelInfo[] {
	return MODEL_CATALOG[provider] ?? [];
}

/**
 * Build Select-compatible options for a provider's models.
 * Recommended models get a star prefix and recommendation tag in their label.
 * Values use the provider-qualified format (e.g., "venice:llama-3.3-70b").
 */
export function buildModelOptions(provider: string): Array<{ label: string; value: string }> {
	const models = getModelsForProvider(provider);
	return models.map((m) => {
		const qualified = `${provider}:${m.id}`;
		const label = m.recommended
			? `\u2605 ${m.displayName} (${m.recommended})`
			: m.displayName;
		return { label, value: qualified };
	});
}

/**
 * Format an Ollama model name for display.
 * Shows parameter size and quantization in parens, disk size in brackets.
 * Skips "unknown" values from the OpenAI-compat fallback.
 */
function formatOllamaModelName(m: OllamaModel): string {
	let label = m.name;

	const paramSize = m.details?.parameter_size;
	const quant = m.details?.quantization_level;
	const hasParam = paramSize && paramSize !== "unknown";
	const hasQuant = quant && quant !== "unknown";

	if (hasParam && hasQuant) {
		label += ` (${paramSize} ${quant})`;
	} else if (hasParam) {
		label += ` (${paramSize})`;
	}

	if (m.size > 0) {
		const sizeGB = (m.size / 1e9).toFixed(1);
		label += ` [${sizeGB}GB]`;
	}

	return label;
}

/**
 * Build Select-compatible options for Ollama models by probing a server.
 * Returns empty array if Ollama is not running or unreachable.
 *
 * @param baseUrl - Ollama server base URL (without /v1 suffix)
 */
export async function buildOllamaModelOptions(
	baseUrl = "http://localhost:11434",
): Promise<Array<{ label: string; value: string }>> {
	const models = await listOllamaModels(baseUrl);
	return models.map((m) => ({
		label: formatOllamaModelName(m),
		value: `ollama:${m.name}`,
	}));
}
