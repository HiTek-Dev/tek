import { createLogger } from "../logger.js";
import { generateAuthToken } from "../crypto/index.js";
import { VaultError } from "../errors.js";
import { keychainSet, keychainGet, keychainDelete } from "./keychain.js";
import { PROVIDERS, type Provider } from "./providers.js";

const logger = createLogger("vault");

/**
 * Add an API key for a provider, storing it in the OS keychain.
 */
export function addKey(provider: Provider, key: string): void {
	keychainSet(`api-key:${provider}`, key);
	logger.info(`API key added for provider: ${provider}`);
}

/**
 * Retrieve an API key for a provider from the OS keychain.
 * Returns null if no key is configured for the provider.
 */
export function getKey(provider: Provider): string | null {
	return keychainGet(`api-key:${provider}`);
}

/**
 * Update an existing API key for a provider.
 * Throws VaultError if no key currently exists for the provider.
 */
export function updateKey(provider: Provider, key: string): void {
	const existing = keychainGet(`api-key:${provider}`);
	if (existing === null) {
		throw new VaultError(
			`No API key exists for provider "${provider}". Use "add" to create one first.`,
		);
	}
	keychainSet(`api-key:${provider}`, key);
	logger.info(`API key updated for provider: ${provider}`);
}

/**
 * Remove an API key for a provider from the OS keychain.
 * Throws VaultError if no key exists for the provider.
 */
export function removeKey(provider: Provider): void {
	const deleted = keychainDelete(`api-key:${provider}`);
	if (!deleted) {
		throw new VaultError(
			`No API key exists for provider "${provider}". Nothing to remove.`,
		);
	}
	logger.info(`API key removed for provider: ${provider}`);
}

/**
 * List all known providers and whether they have a key configured.
 */
export function listProviders(): { provider: Provider; configured: boolean }[] {
	return PROVIDERS.map((provider) => ({
		provider,
		configured: keychainGet(`api-key:${provider}`) !== null,
	}));
}

/**
 * Get or create the auth token used for the local API endpoint.
 * Stores the token in the OS keychain for persistence across sessions.
 */
export function getOrCreateAuthToken(): string {
	const existing = keychainGet("api-endpoint-token");
	if (existing) {
		return existing;
	}

	const token = generateAuthToken();
	keychainSet("api-endpoint-token", token);
	logger.info("Generated new API endpoint auth token");
	return token;
}

export { type Provider } from "./providers.js";
export { PROVIDERS, validateProvider, PROVIDER_KEY_PREFIXES } from "./providers.js";
export { keychainSet, keychainGet, keychainDelete } from "./keychain.js";
