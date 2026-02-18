import React, { useState } from "react";
import { Box, Text } from "ink";
import { Select, TextInput, ConfirmInput } from "@inkjs/ui";
import { type SecurityMode, DISPLAY_NAME, CLI_COMMAND } from "@tek/core";
import type { Provider } from "../vault/index.js";
import { PROVIDERS } from "../vault/index.js";
import { buildModelOptions } from "../lib/models.js";

type OnboardingStep =
	| "welcome"
	| "mode"
	| "workspace"
	| "keys-ask"
	| "keys-provider"
	| "keys-input"
	| "keys-more"
	| "model-select"
	| "model-alias"
	| "summary"
	| "done";

interface ModelAliasEntry {
	alias: string;
	modelId: string;
}

export interface OnboardingResult {
	securityMode: SecurityMode;
	workspaceDir?: string;
	keys: { provider: Provider; key: string }[];
	defaultModel?: string;
	modelAliases?: ModelAliasEntry[];
}

export interface OnboardingProps {
	onComplete: (result: OnboardingResult) => void;
	existingConfig?: {
		securityMode?: SecurityMode;
		workspaceDir?: string;
		defaultModel?: string;
		modelAliases?: ModelAliasEntry[];
		configuredProviders?: string[];
	};
}

export function Onboarding({ onComplete, existingConfig }: OnboardingProps) {
	const [step, setStep] = useState<OnboardingStep>("welcome");
	const [mode, setMode] = useState<SecurityMode>(existingConfig?.securityMode ?? "full-control");
	const [workspaceDir, setWorkspaceDir] = useState(existingConfig?.workspaceDir ?? "");
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

	/** Build the list of available models from the full catalog for configured providers. */
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
		return models;
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
							// Preserve existing mode and skip workspace
							setStep("keys-ask");
						} else {
							setMode(value as SecurityMode);
							if (value === "limited-control") {
								setStep("workspace");
							} else {
								setStep("keys-ask");
							}
						}
					}}
				/>
			</Box>
		);
	}

	if (step === "workspace") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Enter workspace directory path:</Text>
				<Text dimColor>
					The agent will be restricted to this directory and its subdirectories.
				</Text>
				<Text />
				<TextInput
					placeholder="~/workspace"
					onSubmit={(value) => {
						setWorkspaceDir(value);
						setStep("keys-ask");
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
						// Skip keys -- move to model selection if providers are configured
						const models = buildAvailableModels();
						if (models.length > 0) {
							setAvailableModels(models);
							setStep("model-select");
						} else {
							setStep("summary");
						}
					}}
				/>
			</Box>
		);
	}

	if (step === "keys-provider") {
		const configuredProviders = keys.map((k) => k.provider);
		const availableProviders = PROVIDERS.filter(
			(p) => !configuredProviders.includes(p),
		);

		if (availableProviders.length === 0) {
			// All providers configured, move to model selection
			const models = buildAvailableModels();
			if (models.length > 0) {
				setAvailableModels(models);
				setStep("model-select");
			} else {
				setStep("summary");
			}
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
			(p) => !configuredProviders.includes(p),
		);

		if (remaining.length === 0) {
			// All providers configured, move to model selection
			const models = buildAvailableModels();
			if (models.length > 0) {
				setAvailableModels(models);
				setStep("model-select");
			} else {
				setStep("summary");
			}
			return null;
		}

		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Add another API key?</Text>
				<Text />
				<ConfirmInput
					onConfirm={() => setStep("keys-provider")}
					onCancel={() => {
						// Done adding keys, move to model selection
						const models = buildAvailableModels();
						if (models.length > 0) {
							setAvailableModels(models);
							setStep("model-select");
						} else {
							setStep("summary");
						}
					}}
				/>
			</Box>
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
						setStep("model-alias");
					}}
				/>
			</Box>
		);
	}

	if (step === "model-alias") {
		if (aliasIndex >= availableModels.length) {
			// All models processed
			setStep("summary");
			return null;
		}

		const currentModel = availableModels[aliasIndex];

		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>
					Assign alias for {currentModel.label}:
				</Text>
				<Text dimColor>
					Type a short name (e.g. "sonnet") or press Enter to skip. Type "done"
					to skip remaining.{existingConfig?.modelAliases && existingConfig.modelAliases.length > 0 ? ' Type "keep" to preserve existing aliases.' : ""}
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
					placeholder=""
					onSubmit={(value) => {
						const trimmed = value.trim();
						if (trimmed.toLowerCase() === "done") {
							setStep("summary");
							return;
						}
						if (trimmed.toLowerCase() === "keep" && existingConfig?.modelAliases) {
							setModelAliases(existingConfig.modelAliases);
							setStep("summary");
							return;
						}
						if (trimmed) {
							setModelAliases((prev) => [
								...prev,
								{ alias: trimmed, modelId: currentModel.value },
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
				{mode === "limited-control" && workspaceDir && (
					<Text>
						Workspace: <Text bold>{workspaceDir}</Text>
					</Text>
				)}
				<Text>
					API keys:{" "}
					<Text bold>
						{keys.length > 0
							? keys.map((k) => k.provider).join(", ")
							: "none configured"}
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
							workspaceDir:
								mode === "limited-control" ? workspaceDir : undefined,
							keys,
							defaultModel: defaultModel || undefined,
							modelAliases:
								modelAliases.length > 0 ? modelAliases : undefined,
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
				Run <Text bold>{CLI_COMMAND} keys list</Text> to see your configured keys.
			</Text>
			<Text>
				Run <Text bold>{CLI_COMMAND} config show</Text> to view your settings.
			</Text>
		</Box>
	);
}
