import type { Transport } from "../transport.js";
import type {
	VaultKeysList,
	VaultKeysSet,
	VaultKeysDelete,
	VaultKeysTest,
	ConfigGet,
	ConfigUpdate,
	OllamaDiscover,
	ProviderModelsList,
} from "./protocol.js";
import {
	addKey,
	getKey,
	updateKey,
	removeKey,
	listProviders,
	validateProvider,
} from "@tek/core/vault";
import { loadConfig, saveConfig, createLogger } from "@tek/core";

const logger = createLogger("vault-handlers");

// Known models per provider for provider.models.list
const KNOWN_MODELS: Record<string, Array<{ modelId: string; name: string; tier?: "high" | "standard" | "budget" }>> = {
	anthropic: [
		{ modelId: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", tier: "high" },
		{ modelId: "claude-haiku-4-20250414", name: "Claude Haiku 4", tier: "standard" },
		{ modelId: "claude-opus-4-20250514", name: "Claude Opus 4", tier: "high" },
	],
	openai: [
		{ modelId: "gpt-4o", name: "GPT-4o", tier: "high" },
		{ modelId: "gpt-4o-mini", name: "GPT-4o Mini", tier: "standard" },
		{ modelId: "o3-mini", name: "o3-mini", tier: "high" },
	],
	google: [
		{ modelId: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tier: "standard" },
		{ modelId: "gemini-2.5-pro", name: "Gemini 2.5 Pro", tier: "high" },
	],
	venice: [
		{ modelId: "llama-3.3-70b", name: "Llama 3.3 70B", tier: "standard" },
		{ modelId: "deepseek-r1-671b", name: "DeepSeek R1 671B", tier: "high" },
		{ modelId: "dolphin-2.9.3-mistral-7b", name: "Dolphin 2.9.3 Mistral 7B", tier: "budget" },
		{ modelId: "llama-3.2-3b", name: "Llama 3.2 3B", tier: "budget" },
		{ modelId: "nous-theta-8b", name: "Nous Theta 8B", tier: "budget" },
	],
	ollama: [],
};

export function handleVaultKeysList(transport: Transport, msg: VaultKeysList): void {
	try {
		const providers = listProviders();
		transport.send({
			type: "vault.keys.list.result",
			id: msg.id,
			providers,
		});
	} catch (err) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "VAULT_ERROR",
			message: err instanceof Error ? err.message : "Failed to list providers",
		});
	}
}

export function handleVaultKeysSet(transport: Transport, msg: VaultKeysSet): void {
	try {
		const provider = validateProvider(msg.provider);
		const existing = getKey(provider);
		if (existing) {
			updateKey(provider, msg.key);
		} else {
			addKey(provider, msg.key);
		}
		logger.info(`API key set for provider: ${msg.provider}`);
		transport.send({
			type: "vault.keys.set.result",
			id: msg.id,
			provider: msg.provider,
			success: true,
		});
	} catch (err) {
		transport.send({
			type: "vault.keys.set.result",
			id: msg.id,
			provider: msg.provider,
			success: false,
			error: err instanceof Error ? err.message : "Failed to set key",
		});
	}
}

export function handleVaultKeysDelete(transport: Transport, msg: VaultKeysDelete): void {
	try {
		const provider = validateProvider(msg.provider);
		removeKey(provider);
		logger.info(`API key deleted for provider: ${msg.provider}`);
		transport.send({
			type: "vault.keys.delete.result",
			id: msg.id,
			provider: msg.provider,
			success: true,
		});
	} catch (err) {
		transport.send({
			type: "vault.keys.delete.result",
			id: msg.id,
			provider: msg.provider,
			success: false,
			error: err instanceof Error ? err.message : "Failed to delete key",
		});
	}
}

export async function handleVaultKeysTest(transport: Transport, msg: VaultKeysTest): Promise<void> {
	try {
		const provider = validateProvider(msg.provider);
		const key = getKey(provider);
		if (!key) {
			transport.send({
				type: "vault.keys.test.result",
				id: msg.id,
				provider: msg.provider,
				valid: false,
				error: "No API key configured for this provider",
			});
			return;
		}

		// Basic validation: attempt a lightweight API call per provider
		let valid = false;
		let error: string | undefined;

		switch (provider) {
			case "anthropic": {
				const res = await fetch("https://api.anthropic.com/v1/models", {
					headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
				});
				valid = res.ok;
				if (!valid) error = `HTTP ${res.status}: ${res.statusText}`;
				break;
			}
			case "openai": {
				const res = await fetch("https://api.openai.com/v1/models", {
					headers: { Authorization: `Bearer ${key}` },
				});
				valid = res.ok;
				if (!valid) error = `HTTP ${res.status}: ${res.statusText}`;
				break;
			}
			case "google": {
				const res = await fetch(
					`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
				);
				valid = res.ok;
				if (!valid) error = `HTTP ${res.status}: ${res.statusText}`;
				break;
			}
			case "venice": {
				const res = await fetch("https://api.venice.ai/api/v1/models", {
					headers: { Authorization: `Bearer ${key}` },
				});
				valid = res.ok;
				if (!valid) error = `HTTP ${res.status}: ${res.statusText}`;
				break;
			}
			default:
				// For providers without a test endpoint, just check key exists
				valid = true;
				break;
		}

		transport.send({
			type: "vault.keys.test.result",
			id: msg.id,
			provider: msg.provider,
			valid,
			error,
		});
	} catch (err) {
		transport.send({
			type: "vault.keys.test.result",
			id: msg.id,
			provider: msg.provider,
			valid: false,
			error: err instanceof Error ? err.message : "Test failed",
		});
	}
}

export function handleConfigGet(transport: Transport, msg: ConfigGet): void {
	try {
		const config = loadConfig();
		transport.send({
			type: "config.get.result",
			id: msg.id,
			config: (config ?? {}) as Record<string, unknown>,
		});
	} catch (err) {
		transport.send({
			type: "error",
			requestId: msg.id,
			code: "CONFIG_ERROR",
			message: err instanceof Error ? err.message : "Failed to load config",
		});
	}
}

export function handleConfigUpdate(transport: Transport, msg: ConfigUpdate): void {
	try {
		const current = loadConfig();
		if (!current) {
			transport.send({
				type: "config.update.result",
				id: msg.id,
				success: false,
				error: "No config file found. Run 'tek init' first.",
			});
			return;
		}

		// Shallow merge patch into current config
		const updated = { ...current, ...msg.patch } as typeof current;
		saveConfig(updated);
		logger.info("Config updated via desktop");

		transport.send({
			type: "config.update.result",
			id: msg.id,
			success: true,
		});
	} catch (err) {
		transport.send({
			type: "config.update.result",
			id: msg.id,
			success: false,
			error: err instanceof Error ? err.message : "Failed to update config",
		});
	}
}

export async function handleOllamaDiscover(transport: Transport, msg: OllamaDiscover): Promise<void> {
	try {
		const url = msg.url.replace(/\/+$/, "");
		const res = await fetch(`${url}/api/tags`);
		if (!res.ok) {
			transport.send({
				type: "ollama.discover.result",
				id: msg.id,
				models: [],
				error: `Ollama returned HTTP ${res.status}`,
			});
			return;
		}

		const data = (await res.json()) as { models?: Array<{ name: string; size?: number; modified_at?: string }> };
		const models = (data.models ?? []).map((m) => ({
			name: m.name,
			size: m.size,
			modifiedAt: m.modified_at,
		}));

		transport.send({
			type: "ollama.discover.result",
			id: msg.id,
			models,
		});
	} catch (err) {
		transport.send({
			type: "ollama.discover.result",
			id: msg.id,
			models: [],
			error: err instanceof Error ? err.message : "Failed to discover Ollama models",
		});
	}
}

export async function handleProviderModelsList(transport: Transport, msg: ProviderModelsList): Promise<void> {
	if (msg.provider === "ollama") {
		// Try to discover local Ollama models instead of returning empty array
		try {
			const res = await fetch("http://localhost:11434/api/tags");
			if (res.ok) {
				const data = (await res.json()) as { models?: Array<{ name: string; size?: number }> };
				const models = (data.models ?? []).map((m) => ({
					modelId: m.name,
					name: m.name.replace(/:latest$/, ""),
					tier: "standard" as const,
				}));
				transport.send({
					type: "provider.models.list.result",
					id: msg.id,
					provider: msg.provider,
					models,
				});
				return;
			}
		} catch {
			// Ollama not running, fall through to empty list
		}
	}

	const models = KNOWN_MODELS[msg.provider] ?? [];
	transport.send({
		type: "provider.models.list.result",
		id: msg.id,
		provider: msg.provider,
		models,
	});
}
