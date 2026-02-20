import { createProviderRegistry } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getKey } from "@tek/cli/vault";
import { createLogger, loadConfig } from "@tek/core";

const logger = createLogger("llm-registry");

// Extract the provider type from what createProviderRegistry expects
type ProviderRegistry = ReturnType<typeof createProviderRegistry>;
type ProviderMap = Parameters<typeof createProviderRegistry>[0];

let cachedRegistry: ProviderRegistry | null = null;

/**
 * Build a provider registry with the given API keys.
 * If no keys are provided, reads them from the vault.
 *
 * Conditionally registers providers based on available keys.
 * Ollama is always registered (local, no key required).
 */
export function buildRegistry(keys?: {
	anthropic?: string;
	openai?: string;
	venice?: string;
	google?: string;
	ollamaEndpoints?: Array<{ name: string; url: string }>;
}): ProviderRegistry {
	const anthropicKey = keys?.anthropic ?? getKey("anthropic") ?? undefined;
	const openaiKey = keys?.openai ?? getKey("openai") ?? undefined;
	const veniceKey = keys?.venice ?? getKey("venice") ?? undefined;
	const googleKey = keys?.google ?? getKey("google") ?? undefined;

	const providers: ProviderMap = {};

	if (anthropicKey) {
		logger.info("Registering Anthropic provider");
		providers.anthropic = createAnthropic({ apiKey: anthropicKey });
	}

	if (openaiKey) {
		logger.info("Registering OpenAI provider");
		providers.openai = createOpenAI({ apiKey: openaiKey });
	}

	if (veniceKey) {
		logger.info("Registering Venice AI provider");
		providers.venice = createOpenAICompatible({
			name: "venice",
			baseURL: "https://api.venice.ai/api/v1",
			apiKey: veniceKey,
		});
	}

	if (googleKey) {
		logger.info("Registering Google Gemini provider");
		providers.google = createGoogleGenerativeAI({ apiKey: googleKey });
	}

	// Ollama endpoints — configurable, defaults to localhost
	const endpoints = keys?.ollamaEndpoints ?? [
		{ name: "localhost", url: "http://localhost:11434/v1" },
	];

	for (let i = 0; i < endpoints.length; i++) {
		const ep = endpoints[i];
		// First endpoint uses "ollama" for backward compat; rest use "ollama-{name}"
		const providerName = i === 0 ? "ollama" : `ollama-${ep.name}`;
		logger.info(`Registering Ollama provider: ${providerName} (${ep.url})`);
		providers[providerName] = createOpenAICompatible({
			name: providerName,
			baseURL: ep.url,
		});
	}

	return createProviderRegistry(providers);
}

/**
 * Get the singleton provider registry instance.
 * Lazy-initializes on first call, then caches for subsequent calls.
 */
export function getRegistry(): ProviderRegistry {
	if (!cachedRegistry) {
		const cfg = loadConfig();
		cachedRegistry = buildRegistry({
			ollamaEndpoints: cfg?.ollamaEndpoints ?? undefined,
		});
	}
	return cachedRegistry;
}

/**
 * Resolve a model ID to a provider-qualified format.
 *
 * If the model already contains ":" (e.g. "openai:gpt-4o"), return as-is.
 * Otherwise, prefix with the first available provider.
 */
export function resolveModelId(model: string): string {
	if (model.includes(":")) {
		return model;
	}
	// Use first available provider instead of assuming anthropic
	const available = getAvailableProviders();
	const provider = available[0] ?? "ollama";
	return `${provider}:${model}`;
}

/**
 * Check if a specific provider is available (has API key or is always-on like Ollama).
 */
export function isProviderAvailable(providerName: string): boolean {
	const available = getAvailableProviders();
	return available.includes(providerName);
}

/**
 * Get the list of providers that have valid API keys configured.
 * Ollama is always included (local, no key required).
 */
export function getAvailableProviders(): string[] {
	const available: string[] = [];

	if (getKey("anthropic")) {
		available.push("anthropic");
	}

	if (getKey("openai")) {
		available.push("openai");
	}

	if (getKey("venice")) {
		available.push("venice");
	}

	if (getKey("google")) {
		available.push("google");
	}

	// Ollama is always available (may not be running, but it's registered)
	available.push("ollama");

	// Check for additional Ollama endpoints from config
	const cfg = loadConfig();
	if (cfg?.ollamaEndpoints) {
		for (let i = 1; i < cfg.ollamaEndpoints.length; i++) {
			available.push(`ollama-${cfg.ollamaEndpoints[i].name}`);
		}
	}

	return available;
}
