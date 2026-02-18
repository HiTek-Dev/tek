import React, { useState } from "react";
import { Box, Text } from "ink";
import { Select, TextInput, ConfirmInput } from "@inkjs/ui";
import type { SecurityMode } from "@tek/core";
import type { Provider } from "../vault/index.js";
import { PROVIDERS } from "../vault/index.js";

type OnboardingStep =
	| "welcome"
	| "mode"
	| "workspace"
	| "keys-ask"
	| "keys-provider"
	| "keys-input"
	| "keys-more"
	| "summary"
	| "done";

interface OnboardingResult {
	securityMode: SecurityMode;
	workspaceDir?: string;
	keys: { provider: Provider; key: string }[];
}

interface OnboardingProps {
	onComplete: (result: OnboardingResult) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
	const [step, setStep] = useState<OnboardingStep>("welcome");
	const [mode, setMode] = useState<SecurityMode>("full-control");
	const [workspaceDir, setWorkspaceDir] = useState("");
	const [keys, setKeys] = useState<{ provider: Provider; key: string }[]>([]);
	const [currentProvider, setCurrentProvider] = useState<Provider>("anthropic");
	const [currentKey, setCurrentKey] = useState("");

	if (step === "welcome") {
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold color="cyan">
					Welcome to AgentSpace
				</Text>
				<Text />
				<Text>
					AgentSpace is a self-hosted AI agent platform that keeps your
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
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Choose your security mode:</Text>
				<Text />
				<Select
					options={[
						{
							label:
								"Full Control \u2014 OS-level access with explicit permission grants per capability",
							value: "full-control" as const,
						},
						{
							label:
								"Limited Control \u2014 Agent restricted to a designated workspace directory",
							value: "limited-control" as const,
						},
					]}
					onChange={(value) => {
						setMode(value as SecurityMode);
						if (value === "limited-control") {
							setStep("workspace");
						} else {
							setStep("keys-ask");
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
		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Would you like to add an API key now?</Text>
				<Text dimColor>
					You can always add keys later with: agentspace keys add
				</Text>
				<Text />
				<ConfirmInput
					onConfirm={() => setStep("keys-provider")}
					onCancel={() => setStep("summary")}
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
			setStep("summary");
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
			setStep("summary");
			return null;
		}

		return (
			<Box flexDirection="column" padding={1}>
				<Text bold>Add another API key?</Text>
				<Text />
				<ConfirmInput
					onConfirm={() => setStep("keys-provider")}
					onCancel={() => setStep("summary")}
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
				Run <Text bold>agentspace keys list</Text> to see your configured keys.
			</Text>
			<Text>
				Run <Text bold>agentspace config show</Text> to view your settings.
			</Text>
		</Box>
	);
}
