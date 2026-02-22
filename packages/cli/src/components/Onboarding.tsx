import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Select, TextInput, ConfirmInput, MultiSelect } from "@inkjs/ui";
import { type SecurityMode, DISPLAY_NAME, CLI_COMMAND } from "@tek/core";
import type { Provider } from "@tek/core/vault";
import { PROVIDERS } from "@tek/core/vault";
import { buildModelOptions, buildOllamaModelOptions } from "../lib/models.js";

type OnboardingStep =
	| "welcome"
	| "mode"
	| "keys-ask"
	| "keys-provider"
	| "keys-input"
	| "keys-more"
	| "telegram-ask"
	| "telegram-input"
	| "brave-ask"
	| "brave-input"
	| "ollama-detect"
	| "ollama-remote-ask"
	| "ollama-remote-input"
	| "model-select"
	| "model-alias-select"
	| "model-alias-name"
	| "summary"
	| "done";

interface ModelAliasEntry {
	alias: string;
	modelId: string;
}

export interface OnboardingResult {
	securityMode: SecurityMode;
	keys: { provider: Provider; key: string }[];
	defaultModel?: string;
	modelAliases?: ModelAliasEntry[];
	telegramToken?: string;
	ollamaEndpoints?: Array<{ name: string; url: string }>;
}

export interface OnboardingProps {
	onComplete: (result: OnboardingResult) => void;
	existingConfig?: {
		securityMode?: SecurityMode;
		defaultModel?: string;
		modelAliases?: ModelAliasEntry[];
		configuredProviders?: string[];
	};
}

export function Onboarding({ onComplete, existingConfig }: OnboardingProps) {
	const [step, setStep] = useState<OnboardingStep>("welcome");
	const [mode, setMode] = useState<SecurityMode>(existingConfig?.securityMode ?? "full-control");
	const [keys, setKeys] = useState<{ provider: Provider; key: string }[]>([]);
	const [currentProvider, setCurrentProvider] = useState<Provider>("anthropic");
	const [currentKey, setCurrentKey] = useState("");

	// Model selection state
	const [defaultModel, setDefaultModel] = useState<string>(existingConfig?.defaultModel ?? "");
	const [modelAliases, setModelAliases] = useState<ModelAliasEntry[]>(existingConfig?.modelAliases ?? []);
	const [availableModels, setAvailableModels] = useState<
		Array<{ label: string; value: string }>
	>([]);
	const [aliasIndex, setAliasIndex] = useState(0);
	const [modelsToAlias, setModelsToAlias] = useState<string[]>([]);
	const [aliasKeepDecided, setAliasKeepDecided] = useState(false);

	// Telegram state
	const [telegramToken, setTelegramToken] = useState("");

	// Brave Search state
	const [braveApiKey, setBraveApiKey] = useState("");

	// Ollama state
	const [ollamaEndpoints, setOllamaEndpoints] = useState<Array<{ name: string; url: string }>>([]);
	const [ollamaModels, setOllamaModels] = useState<Array<{ label: string; value: string }>>([]);
	const [ollamaProbing, setOllamaProbing] = useState(false);
	const [ollamaLocalDetected, setOllamaLocalDetected] = useState(false);
	const [ollamaRemoteError, setOllamaRemoteError] = useState("");

	/** Build the list of available models from the full catalog for configured providers, including discovered Ollama models. */
	function buildAvailableModels(): Array<{ label: string; value: string }> {
		// Use providers from both newly-entered keys and pre-existing config
		const providerSet = new Set<string>(keys.map((k) => k.provider));
		if (existingConfig?.configuredProviders) {
			for (const p of existingConfig.configuredProviders) {
				providerSet.add(p);
			}
		}
		const models: Array<{ label: string; value: string }> = [];
		for (const provider of providerSet) {
			models.push(...buildModelOptions(provider));
		}
		// Include discovered Ollama models
		if (ollamaModels.length > 0) {
			models.push(...ollamaModels);
		}
		return models;
	}

	/** Transition to telegram-ask step (from keys flow). */
	function goToTelegramAsk() {
		setStep("telegram-ask");
	}

	/** Transition to model-select, or skip to summary if no models available. */
	function goToModelSelect() {
		const models = buildAvailableModels();
		if (models.length > 0) {
			setAvailableModels(models);
			setStep("model-select");
		} else {
			setStep("summary");
		}
	}

	if (step === "welcome") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="cyan">
					Welcome to {DISPLAY_NAME}
				</Text>
				<Text />
				<Text>
					{DISPLAY_NAME} is a self-hosted AI agent platform that keeps your
				</Text>
				<Text>
					credentials secure and gives you full control over agent behavior.
				</Text>
				<Text />
				<Text dimColor>Press Enter to continue...</Text>
				<TextInput
					placeholder=""
					onSubmit={() => setStep("mode")}
				/>
			</Box>
		);
	}

	if (step === "mode") {
		const modeOptions: Array<{ label: string; value: string }> = [];
		if (existingConfig?.securityMode) {
			const currentLabel = existingConfig.securityMode === "full-control" ? "Full Control" : "Limited Control";
			modeOptions.push({ label: `Keep current: ${currentLabel}`, value: "__keep__" });
		}
		modeOptions.push(
			{
				label: "Full Control \u2014 OS-level access with explicit permission grants per capability",
				value: "full-control",
			},
			{
				label: "Limited Control \u2014 Agent restricted to a designated workspace directory",
				value: "limited-control",
			},
		);

		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Choose your security mode:</Text>
				<Text />
				<Select
					options={modeOptions}
					onChange={(value) => {
						if (value === "__keep__") {
							setStep("keys-ask");
						} else {
							setMode(value as SecurityMode);
							setStep("keys-ask");
						}
					}}
				/>
			</Box>
		);
	}

	if (step === "keys-ask") {
		const hasExistingProviders = existingConfig?.configuredProviders && existingConfig.configuredProviders.length > 0;
		return (
			<Box flexDirection="column" padding={1}>
				{hasExistingProviders && (
					<Text>Currently configured: <Text bold>{existingConfig!.configuredProviders!.join(", ")}</Text></Text>
				)}
				<Text bold>{hasExistingProviders ? "Would you like to change API keys?" : "Would you like to add an API key now?"}</Text>
				<Text dimColor>
					You can always add keys later with: {CLI_COMMAND} keys add
				</Text>
				<Text />
				<ConfirmInput
					onConfirm={() => setStep("keys-provider")}
					onCancel={() => {
						// Skip keys -- move to telegram
						goToTelegramAsk();
					}}
				/>
			</Box>
		);
	}

	if (step === "keys-provider") {
		const configuredProviders = keys.map((k) => k.provider);
		const availableProviders = PROVIDERS.filter(
			(p) => !configuredProviders.includes(p) && p !== "telegram",
		);

		if (availableProviders.length === 0) {
			// All providers configured, move to telegram
			goToTelegramAsk();
			return null;
		}

		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Select a provider:</Text>
				<Text />
				<Select
					options={availableProviders.map((p) => ({
						label: p,
						value: p,
					}))}
					onChange={(value) => {
						setCurrentProvider(value as Provider);
						setCurrentKey("");
						setStep("keys-input");
					}}
				/>
			</Box>
		);
	}

	if (step === "keys-input") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>
					Enter API key for {currentProvider}:
				</Text>
				<Text dimColor>The key will be stored securely in your OS keychain.</Text>
				<Text />
				<TextInput
					placeholder="Enter your API key..."
					onSubmit={(value) => {
						if (value.trim()) {
							setKeys((prev) => [
								...prev,
								{ provider: currentProvider, key: value.trim() },
							]);
						}
						setCurrentKey("");
						setStep("keys-more");
					}}
				/>
			</Box>
		);
	}

	if (step === "keys-more") {
		const configuredProviders = keys.map((k) => k.provider);
		const remaining = PROVIDERS.filter(
			(p) => !configuredProviders.includes(p) && p !== "telegram",
		);

		if (remaining.length === 0) {
			// All providers configured, move to telegram
			goToTelegramAsk();
			return null;
		}

		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Add another API key?</Text>
				<Text />
				<ConfirmInput
					onConfirm={() => setStep("keys-provider")}
					onCancel={() => {
						// Done adding keys, move to telegram
						goToTelegramAsk();
					}}
				/>
			</Box>
		);
	}

	if (step === "telegram-ask") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Set up Telegram integration?</Text>
				<Text dimColor>
					You'll need a bot token from @BotFather on Telegram.
				</Text>
				<Text />
				<ConfirmInput
					onConfirm={() => setStep("telegram-input")}
					onCancel={() => {
						setStep("brave-ask");
					}}
				/>
			</Box>
		);
	}

	if (step === "telegram-input") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Enter your Telegram bot token:</Text>
				<Text dimColor>
					Get one from @BotFather: /newbot command, then copy the token.
				</Text>
				<Text />
				<TextInput
					placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
					onSubmit={(value) => {
						if (value.trim()) {
							setTelegramToken(value.trim());
						}
						setStep("brave-ask");
					}}
				/>
			</Box>
		);
	}

	if (step === "brave-ask") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Set up Brave Search API?</Text>
				<Text dimColor>
					Free tier: 2000 queries/month. Get a key at https://brave.com/search/api/
				</Text>
				<Text />
				<ConfirmInput
					onConfirm={() => setStep("brave-input")}
					onCancel={() => setStep("ollama-detect")}
				/>
			</Box>
		);
	}

	if (step === "brave-input") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Enter your Brave Search API key:</Text>
				<Text dimColor>
					Get one from https://brave.com/search/api/ -- click "Get API Key"
				</Text>
				<Text />
				<TextInput
					placeholder="BSA..."
					onSubmit={(value) => {
						if (value.trim()) {
							setBraveApiKey(value.trim());
							setKeys((prev) => [...prev, { provider: "brave" as Provider, key: value.trim() }]);
						}
						setStep("ollama-detect");
					}}
				/>
			</Box>
		);
	}

	if (step === "ollama-detect") {
		return (
			<OllamaDetectStep
				onModelsFound={(models) => {
					setOllamaLocalDetected(true);
					setOllamaModels((prev) => {
						const seen = new Set(prev.map((m) => m.value));
						return [...prev, ...models.filter((m) => !seen.has(m.value))];
					});
					setOllamaEndpoints((prev) => [...prev, { name: "localhost", url: "http://localhost:11434" }]);
					setStep("ollama-remote-ask");
				}}
				onSkip={() => goToModelSelect()}
				onAddRemote={() => setStep("ollama-remote-input")}
			/>
		);
	}

	if (step === "ollama-remote-ask") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Add a remote Ollama instance?</Text>
				<Text dimColor>
					e.g., a GPU server on your LAN at 192.168.1.100:11434
				</Text>
				<Text />
				<ConfirmInput
					onConfirm={() => {
						setOllamaRemoteError("");
						setStep("ollama-remote-input");
					}}
					onCancel={() => goToModelSelect()}
				/>
			</Box>
		);
	}

	if (step === "ollama-remote-input") {
		return (
			<OllamaRemoteInputStep
				error={ollamaRemoteError}
				onSuccess={(url, models) => {
					const hostname = url.replace(/^https?:\/\//, "").replace(/:\d+$/, "");
					setOllamaEndpoints((prev) => [...prev, { name: hostname, url }]);
					setOllamaModels((prev) => {
						const seen = new Set(prev.map((m) => m.value));
						return [...prev, ...models.filter((m) => !seen.has(m.value))];
					});
					setOllamaRemoteError("");
					setStep("ollama-remote-ask");
				}}
				onError={(msg) => setOllamaRemoteError(msg)}
				onSkip={() => goToModelSelect()}
			/>
		);
	}

	if (step === "model-select") {
		const options: Array<{ label: string; value: string }> = [];
		if (existingConfig?.defaultModel) {
			options.push({ label: `Keep current: ${existingConfig.defaultModel}`, value: "__keep__" });
		}
		options.push(
			...availableModels,
			{ label: "Skip -- use first available", value: "__skip__" },
		);

		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Choose your default model:</Text>
				<Text dimColor>
					This will be used when no model is specified in chat.
				</Text>
				<Text />
				<Select
					options={options}
					onChange={(value) => {
						if (value === "__keep__") {
							setDefaultModel(existingConfig!.defaultModel!);
						} else if (value !== "__skip__") {
							setDefaultModel(value);
						} else if (availableModels.length > 0) {
							// Use the first available model as default
							setDefaultModel(availableModels[0].value);
						}
						// Start alias assignment
						setAliasIndex(0);
						setStep("model-alias-select");
					}}
				/>
			</Box>
		);
	}

	if (step === "model-alias-select") {
		const hasExistingAliases = existingConfig?.modelAliases && existingConfig.modelAliases.length > 0;

		if (hasExistingAliases && !aliasKeepDecided) {
			// Show options to keep, choose new, or skip aliases
			const aliasPreview = existingConfig!.modelAliases!
				.map((a) => `${a.alias} -> ${a.modelId}`)
				.join(", ");
			return (
				<Box flexDirection="column" padding={1}>
					<Text bold>Model Aliases</Text>
					<Text dimColor>Current aliases: {aliasPreview}</Text>
					<Text />
					<Select
						options={[
							{ label: "Keep current aliases", value: "keep" },
							{ label: "Choose new aliases", value: "choose" },
							{ label: "Skip aliases", value: "skip" },
						]}
						onChange={(value) => {
							if (value === "keep") {
								setModelAliases(existingConfig!.modelAliases!);
								setStep("summary");
							} else if (value === "skip") {
								setModelAliases([]);
								setStep("summary");
							} else {
								// "choose" — fall through to MultiSelect
								setAliasKeepDecided(true);
								setModelAliases([]);
							}
						}}
					/>
				</Box>
			);
		}

		// Show MultiSelect for picking which models to alias
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Select models to create aliases for:</Text>
				<Text dimColor>
					Space to toggle, Enter to confirm. Enter with none selected to skip.
				</Text>
				<Text />
				<MultiSelect
					options={availableModels}
					visibleOptionCount={8}
					onSubmit={(selected) => {
						if (selected.length === 0) {
							setStep("summary");
						} else {
							setModelsToAlias(selected);
							setAliasIndex(0);
							setStep("model-alias-name");
						}
					}}
				/>
			</Box>
		);
	}

	if (step === "model-alias-name") {
		if (aliasIndex >= modelsToAlias.length) {
			setStep("summary");
			return null;
		}

		const currentModelId = modelsToAlias[aliasIndex];
		const currentModelLabel =
			availableModels.find((m) => m.value === currentModelId)?.label ?? currentModelId;

		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>
					Assign alias for {currentModelLabel}:
				</Text>
				<Text dimColor>
					Type a short name (e.g. "sonnet") or press Enter to skip.
				</Text>
				{modelAliases.length > 0 && (
					<Box flexDirection="column" marginTop={1}>
						<Text dimColor>
							Aliases so far:{" "}
							{modelAliases
								.map((a) => `${a.alias} -> ${a.modelId}`)
								.join(", ")}
						</Text>
					</Box>
				)}
				<Text />
				<TextInput
					key={`alias-${aliasIndex}`}
					placeholder=""
					onSubmit={(value) => {
						const trimmed = value.trim();
						if (trimmed) {
							setModelAliases((prev) => [
								...prev,
								{ alias: trimmed, modelId: currentModelId },
							]);
						}
						setAliasIndex((prev) => prev + 1);
					}}
				/>
			</Box>
		);
	}

	if (step === "summary") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="cyan">
					Setup Summary
				</Text>
				<Text />
				<Text>
					Security mode:{" "}
					<Text bold>
						{mode === "full-control" ? "Full Control" : "Limited Control"}
					</Text>
				</Text>
				<Text>
					API keys:{" "}
					<Text bold>
						{keys.length > 0
							? keys.map((k) => k.provider).join(", ")
							: "none configured"}
					</Text>
				</Text>
				<Text>
					Telegram:{" "}
					<Text bold>
						{telegramToken ? "configured" : "not configured"}
					</Text>
				</Text>
				<Text>
					Brave Search:{" "}
					<Text bold>
						{braveApiKey ? "configured" : "not configured"}
					</Text>
				</Text>
				<Text>
					Ollama:{" "}
					<Text bold>
						{ollamaEndpoints.length > 0
							? `${ollamaEndpoints.length} endpoint${ollamaEndpoints.length > 1 ? "s" : ""} (${ollamaModels.length} model${ollamaModels.length !== 1 ? "s" : ""})`
							: "not configured"}
					</Text>
				</Text>
				{defaultModel && (
					<Text>
						Default model: <Text bold>{defaultModel}</Text>
					</Text>
				)}
				{modelAliases.length > 0 && (
					<Box flexDirection="column">
						<Text>Model aliases:</Text>
						{modelAliases.map((a) => (
							<Text key={a.alias}>
								{"  "}
								<Text bold>{a.alias}</Text> {"->"} {a.modelId}
							</Text>
						))}
					</Box>
				)}
				<Text>
					API endpoint:{" "}
					<Text bold>will be available at 127.0.0.1:3271</Text>
				</Text>
				<Text />
				<Text dimColor>Press Enter to complete setup...</Text>
				<TextInput
					placeholder=""
					onSubmit={() => {
						setStep("done");
						onComplete({
							securityMode: mode,
							keys,
							defaultModel: defaultModel || undefined,
							modelAliases:
								modelAliases.length > 0 ? modelAliases : undefined,
							telegramToken: telegramToken || undefined,
							ollamaEndpoints:
								ollamaEndpoints.length > 0 ? ollamaEndpoints : undefined,
						});
					}}
				/>
			</Box>
		);
	}

	// step === "done"
	return (
		<Box flexDirection="column" padding={1}>
			<Text bold color="green">
				Setup complete!
			</Text>
			<Text>
				Run <Text bold>{CLI_COMMAND} onboard</Text> to create your first agent.
			</Text>
			<Text />
			<Text>
				Run <Text bold>{CLI_COMMAND} keys list</Text> to see your configured keys.
			</Text>
			<Text>
				Run <Text bold>{CLI_COMMAND} config show</Text> to view your settings.
			</Text>
		</Box>
	);
}

/**
 * Sub-component: Ollama auto-detection step.
 * Probes localhost:11434 on mount and shows discovered models.
 */
function OllamaDetectStep({
	onModelsFound,
	onSkip,
	onAddRemote,
}: {
	onModelsFound: (models: Array<{ label: string; value: string }>) => void;
	onSkip: () => void;
	onAddRemote: () => void;
}) {
	const [probing, setProbing] = useState(true);
	const [models, setModels] = useState<Array<{ label: string; value: string }>>([]);
	const [probeComplete, setProbeComplete] = useState(false);

	useEffect(() => {
		let cancelled = false;
		buildOllamaModelOptions("http://localhost:11434").then((result) => {
			if (cancelled) return;
			setModels(result);
			setProbing(false);
			setProbeComplete(true);
		});
		return () => { cancelled = true; };
	}, []);

	if (probing) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Detecting Ollama...</Text>
				<Text dimColor>Probing localhost:11434 for local models</Text>
			</Box>
		);
	}

	if (probeComplete && models.length > 0) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="green">
					Found Ollama with {models.length} model{models.length !== 1 ? "s" : ""}:
				</Text>
				{models.slice(0, 10).map((m) => (
					<Text key={m.value}>  {m.label}</Text>
				))}
				{models.length > 10 && (
					<Text dimColor>  ...and {models.length - 10} more</Text>
				)}
				<Text />
				<Select
					options={[
						{ label: "Use these models", value: "use" },
						{ label: "Skip Ollama", value: "skip" },
					]}
					onChange={(value) => {
						if (value === "use") {
							onModelsFound(models);
						} else {
							onSkip();
						}
					}}
				/>
			</Box>
		);
	}

	// No models found / Ollama not running
	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>Ollama not detected on localhost</Text>
			<Text dimColor>
				Start Ollama with "ollama serve" to use local models, or add a remote instance.
			</Text>
			<Text />
			<Select
				options={[
					{ label: "Add remote Ollama endpoint", value: "remote" },
					{ label: "Skip", value: "skip" },
				]}
				onChange={(value) => {
					if (value === "remote") {
						onAddRemote();
					} else {
						onSkip();
					}
				}}
			/>
		</Box>
	);
}

/**
 * Sub-component: Remote Ollama endpoint input step.
 * Accepts a host:port, probes it, and reports success or error.
 */
function OllamaRemoteInputStep({
	error,
	onSuccess,
	onError,
	onSkip,
}: {
	error: string;
	onSuccess: (url: string, models: Array<{ label: string; value: string }>) => void;
	onError: (msg: string) => void;
	onSkip: () => void;
}) {
	const [probing, setProbing] = useState(false);
	const [probedUrl, setProbedUrl] = useState("");

	function handleSubmit(value: string) {
		const trimmed = value.trim();
		if (!trimmed) {
			onSkip();
			return;
		}

		// Normalize: prepend http:// if no protocol given
		const url = trimmed.startsWith("http://") || trimmed.startsWith("https://")
			? trimmed
			: `http://${trimmed}`;

		setProbing(true);
		setProbedUrl(url);

		const hostname = url.replace(/^https?:\/\//, "").replace(/:\d+$/, "");
		buildOllamaModelOptions(url, `ollama-${hostname}`).then((models) => {
			setProbing(false);
			if (models.length > 0) {
				onSuccess(url, models);
			} else {
				onError(
					`Could not reach Ollama at ${url}. Ensure the remote server has OLLAMA_HOST=0.0.0.0 configured.`,
				);
			}
		});
	}

	if (probing) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Probing {probedUrl}...</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>Enter remote Ollama address:</Text>
			<Text dimColor>
				Format: host:port (e.g., 192.168.1.100:11434). Press Enter empty to skip.
			</Text>
			{error ? (
				<>
					<Text />
					<Text color="red">{error}</Text>
				</>
			) : null}
			<Text />
			<TextInput
				placeholder="192.168.1.100:11434"
				onSubmit={handleSubmit}
			/>
		</Box>
	);
}
