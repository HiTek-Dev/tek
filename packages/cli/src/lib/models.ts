/**
 * Centralized model catalog with per-provider recommendations.
 *
 * Provides a single source of truth for all known models across providers,
 * with recommendation tags and display helpers for the Onboarding wizard.
 */

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
		{ id: "venice-uncensored", displayName: "Venice Uncensored", recommended: "general", tier: "s" },
		{ id: "mistral-31-24b", displayName: "Mistral Small 3.1", tier: "s" },
		{ id: "llama-3.2-3b", displayName: "Llama 3.2 3B", tier: "xs" },
		{ id: "llama-3.3-70b", displayName: "Llama 3.3 70B", recommended: "low-cost", tier: "m" },
		{ id: "qwen3-4b", displayName: "Qwen3 4B", tier: "xs" },
		{ id: "qwen3-next-80b", displayName: "Qwen3 Next 80B", tier: "m" },
		{ id: "qwen3-235b-a22b-instruct-2507", displayName: "Qwen3 235B Instruct", tier: "l" },
		{ id: "qwen3-235b-a22b-thinking-2507", displayName: "Qwen3 235B Thinking", tier: "l" },
		{ id: "qwen3-coder-480b-a35b-instruct", displayName: "Qwen3 Coder 480B", recommended: "coding", tier: "l" },
		{ id: "qwen-2.5-qwq-32b", displayName: "QwQ 32B", recommended: "reasoning", tier: "m" },
		{ id: "qwen-2.5-vl", displayName: "Qwen 2.5 VL", tier: "m" },
		{ id: "qwen-2.5-coder-32b", displayName: "Qwen 2.5 Coder 32B", tier: "m" },
		{ id: "deepseek-ai-DeepSeek-R1", displayName: "DeepSeek R1 671B", tier: "l" },
		{ id: "google-gemma-3-27b-it", displayName: "Google Gemma 3 27B", tier: "m" },
		{ id: "grok-41-fast", displayName: "Grok 41 Fast", tier: "l" },
		{ id: "kimi-k2-thinking", displayName: "Kimi K2 Thinking", tier: "l" },
		{ id: "gemini-3-pro-preview", displayName: "Gemini 3 Pro Preview", tier: "l" },
		{ id: "hermes-3-llama-3.1-405b", displayName: "Hermes 3 405B", tier: "l" },
		{ id: "zai-org-glm-4.7", displayName: "GLM 4.7", tier: "l" },
		{ id: "openai-gpt-oss-120b", displayName: "OpenAI GPT OSS 120B", tier: "l" },
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
