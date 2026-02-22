import { Command } from "commander";
import chalk from "chalk";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import React from "react";
import { render } from "ink";
import {
	configExists,
	loadConfig,
	saveConfig,
	CLI_COMMAND,
	DISPLAY_NAME,
} from "@tek/core";
import type { AgentDefinition } from "@tek/core";
import {
	applyPersonalityPreset,
	ensureMemoryFile,
	ensurePersonalityFiles,
	resolveAgentDir,
} from "@tek/db";
import {
	AgentOnboarding,
	type AgentOnboardingResult,
} from "../components/AgentOnboarding.js";
import { listProviders } from "@tek/core/vault";

/**
 * Resolve a path that may start with ~ to an absolute path.
 */
function resolvePath(inputPath: string): string {
	if (inputPath.startsWith("~/") || inputPath === "~") {
		return resolve(homedir(), inputPath.slice(2));
	}
	return resolve(inputPath);
}

/**
 * Derive a URL-safe agent ID from a display name.
 */
function toAgentId(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export const onboardCommand = new Command("onboard")
	.description("Create and configure a new agent")
	.option("-n, --name <name>", "Agent name")
	.action(async (options: { name?: string }) => {
		// Guard: tek init must be completed first
		if (!configExists()) {
			console.log(
				chalk.red(
					`Run '${CLI_COMMAND} init' first to set up API keys and global config.`,
				),
			);
			process.exit(1);
		}

		// Get configured providers for model selection
		const configuredProviderNames = listProviders()
			.filter((p) => p.configured)
			.map((p) => p.provider);

		// Run agent onboarding wizard
		await new Promise<void>((resolvePromise) => {
			const { waitUntilExit } = render(
				React.createElement(AgentOnboarding, {
					initialName: options.name,
					configuredProviders: configuredProviderNames,
					onComplete: async (result: AgentOnboardingResult) => {
						const agentId = toAgentId(result.agentName);
						const agentDir = resolveAgentDir(agentId);

						// Ensure personality files have actual content, not just stubs
						if (result.personalityPreset && result.personalityPreset !== "skip") {
							ensurePersonalityFiles(
								agentId,
								result.personalityPreset,
								result.agentName,
								result.userDisplayName,
							);
						}

						// Build agent definition
						const agent: AgentDefinition = {
							id: agentId,
							name: result.agentName,
							model: result.modelOverride,
							description: result.purpose,
							accessMode: result.accessMode,
							workspaceDir: result.workspaceDir
								? resolvePath(result.workspaceDir)
								: undefined,
							personalityPreset: result.personalityPreset,
							purpose: result.purpose,
							createdAt: new Date().toISOString(),
						};

						// Update config (configExists() already verified above)
						const config = loadConfig()!;
						if (!config.agents) {
							config.agents = { list: [], defaultAgentId: "" };
						}
						config.agents.list.push(agent);

						// Set as default if this is the first agent
						if (
							config.agents.list.length === 1 ||
							!config.agents.defaultAgentId
						) {
							config.agents.defaultAgentId = agentId;
						}

						// Persist userDisplayName globally if provided and not already set
						if (result.userDisplayName && !config.userDisplayName) {
							config.userDisplayName = result.userDisplayName;
						}

						saveConfig(config);

						console.log(
							chalk.green(
								`\nAgent "${result.agentName}" (${agentId}) created successfully.`,
							),
						);
						console.log(
							`Agent directory: ${agentDir}`,
						);

						setTimeout(() => {
							resolvePromise();
						}, 500);
					},
				}),
			);

			waitUntilExit().then(() => resolvePromise());
		});
	});
