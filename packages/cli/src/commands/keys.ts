import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline";
import {
	addKey,
	updateKey,
	removeKey,
	listProviders,
	validateProvider,
	PROVIDER_KEY_PREFIXES,
} from "../vault/index.js";
import type { Provider } from "../vault/index.js";

/**
 * Prompt for a key value with hidden input (no echo).
 */
async function promptForKey(provider: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stderr,
			terminal: true,
		});

		process.stderr.write(`Enter API key for ${provider}: `);

		// Attempt to disable echo for hidden input
		if (process.stdin.isTTY) {
			process.stdin.setRawMode?.(true);
		}

		let key = "";
		const onData = (char: Buffer) => {
			const str = char.toString();
			if (str === "\n" || str === "\r" || str === "\u0003") {
				if (process.stdin.isTTY) {
					process.stdin.setRawMode?.(false);
				}
				process.stdin.removeListener("data", onData);
				process.stderr.write("\n");
				rl.close();
				if (str === "\u0003") {
					reject(new Error("Interrupted"));
					return;
				}
				resolve(key);
				return;
			}
			if (str === "\u007F" || str === "\b") {
				// Handle backspace
				key = key.slice(0, -1);
			} else {
				key += str;
			}
		};

		process.stdin.on("data", onData);
	});
}

/**
 * Get a key value from --key option or interactive prompt.
 */
async function getKeyValue(
	provider: string,
	keyOption: string | undefined,
): Promise<string> {
	if (keyOption) {
		return keyOption;
	}
	return promptForKey(provider);
}

/**
 * Print a warning if the key prefix does not match the expected pattern.
 */
function warnKeyPrefix(provider: Provider, key: string): void {
	const expectedPrefix = PROVIDER_KEY_PREFIXES[provider];
	if (expectedPrefix && !key.startsWith(expectedPrefix)) {
		console.log(
			chalk.yellow(
				`Warning: Key does not start with expected prefix "${expectedPrefix}" for ${provider}. Proceeding anyway.`,
			),
		);
	}
}

export const keysCommand = new Command("keys").description(
	"Manage API keys for LLM providers",
);

keysCommand
	.command("add <provider>")
	.description("Add an API key for a provider")
	.option("--key <value>", "API key value (omit for interactive prompt)")
	.action(async (providerInput: string, options: { key?: string }) => {
		try {
			const provider = validateProvider(providerInput);
			const key = await getKeyValue(provider, options.key);

			if (!key.trim()) {
				console.log(chalk.red("Error: API key cannot be empty"));
				process.exit(1);
			}

			warnKeyPrefix(provider, key);
			addKey(provider, key);
			console.log(
				chalk.green(`API key for ${provider} stored in keychain`),
			);
		} catch (error) {
			console.log(
				chalk.red(
					`Error: ${error instanceof Error ? error.message : String(error)}`,
				),
			);
			process.exit(1);
		}
	});

keysCommand
	.command("update <provider>")
	.description("Update an existing API key for a provider")
	.option("--key <value>", "New API key value (omit for interactive prompt)")
	.action(async (providerInput: string, options: { key?: string }) => {
		try {
			const provider = validateProvider(providerInput);
			const key = await getKeyValue(provider, options.key);

			if (!key.trim()) {
				console.log(chalk.red("Error: API key cannot be empty"));
				process.exit(1);
			}

			warnKeyPrefix(provider, key);
			updateKey(provider, key);
			console.log(
				chalk.green(`API key for ${provider} updated in keychain`),
			);
		} catch (error) {
			console.log(
				chalk.red(
					`Error: ${error instanceof Error ? error.message : String(error)}`,
				),
			);
			process.exit(1);
		}
	});

keysCommand
	.command("remove <provider>")
	.description("Remove an API key for a provider")
	.action((providerInput: string) => {
		try {
			const provider = validateProvider(providerInput);
			removeKey(provider);
			console.log(
				chalk.green(`API key for ${provider} removed from keychain`),
			);
		} catch (error) {
			console.log(
				chalk.red(
					`Error: ${error instanceof Error ? error.message : String(error)}`,
				),
			);
			process.exit(1);
		}
	});

keysCommand
	.command("list")
	.description("List all providers and their key status")
	.action(() => {
		try {
			const providers = listProviders();
			console.log("\nProvider Key Status:\n");
			for (const { provider, configured } of providers) {
				const status = configured
					? chalk.green("\u2713 configured")
					: chalk.red("\u2717 not configured");
				console.log(`  ${provider.padEnd(12)} ${status}`);
			}
			console.log();
		} catch (error) {
			console.log(
				chalk.red(
					`Error: ${error instanceof Error ? error.message : String(error)}`,
				),
			);
			process.exit(1);
		}
	});
