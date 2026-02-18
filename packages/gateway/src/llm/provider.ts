import { createAnthropic } from "@ai-sdk/anthropic";
import { getKey } from "@tek/cli/vault";
import { createLogger, CLI_COMMAND } from "@tek/core";

const logger = createLogger("llm-provider");

/**
 * Get an Anthropic provider instance using the API key stored in the vault.
 * Throws a descriptive error if no key is configured.
 *
 * @deprecated Use `getRegistry().languageModel("anthropic:model-name")` from
 * `./registry.js` instead. This function is kept for backward compatibility.
 */
export function getAnthropicProvider(): ReturnType<typeof createAnthropic> {
	const apiKey = getKey("anthropic");
	if (!apiKey) {
		throw new Error(
			`Anthropic API key not configured. Run: ${CLI_COMMAND} keys add anthropic`,
		);
	}

	logger.info("Creating Anthropic provider with vault API key");
	return createAnthropic({ apiKey });
}
