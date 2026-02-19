import { VaultError } from "@tek/core";

export const PROVIDERS = ["anthropic", "openai", "ollama", "venice", "google", "telegram"] as const;

export type Provider = (typeof PROVIDERS)[number];

/**
 * Expected key prefixes for each provider. Used for validation warnings only,
 * not hard enforcement (providers may change their key formats).
 */
export const PROVIDER_KEY_PREFIXES: Record<Provider, string | null> = {
	anthropic: "sk-ant-",
	openai: "sk-",
	ollama: null,
	venice: null,
	google: null,
	telegram: null,
};

/**
 * Validate that a string is a known provider name.
 * Throws VaultError if the provider is not recognized.
 */
export function validateProvider(input: string): Provider {
	if (!(PROVIDERS as readonly string[]).includes(input)) {
		throw new VaultError(
			`Unknown provider: "${input}". Valid providers: ${PROVIDERS.join(", ")}`,
		);
	}
	return input as Provider;
}
