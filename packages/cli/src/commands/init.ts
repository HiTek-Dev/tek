import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { homedir } from "node:os";
import React from "react";
import { render } from "ink";
import {
	configExists,
	loadConfig,
	saveConfig,
	type AppConfig,
	DISPLAY_NAME,
} from "@tek/core";
import { recordAuditEvent } from "@tek/db";
import { Onboarding } from "../components/Onboarding.js";
import { addKey, getOrCreateAuthToken, listProviders } from "../vault/index.js";

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
 * Simple y/n confirmation prompt (not Ink-based).
 */
function confirmPrompt(message: string): Promise<boolean> {
	return new Promise((res) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question(`${message} (y/n) `, (answer) => {
			rl.close();
			res(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
		});
	});
}

export const initCommand = new Command("init")
	.description(`Set up ${DISPLAY_NAME} for first use`)
	.action(async () => {
		// Check if already configured
		if (configExists()) {
			console.log(chalk.yellow(`${DISPLAY_NAME} is already configured.`));
			const rerun = await confirmPrompt(
				"Re-run setup? (existing API keys will be preserved)",
			);
			if (!rerun) {
				console.log("Setup cancelled.");
				return;
			}
		}

		// Load existing config for skip support when re-running
		const existing = configExists() ? loadConfig() : null;
		const configuredProviderNames = listProviders()
			.filter((p) => p.configured)
			.map((p) => p.provider);

		// Run onboarding wizard
		await new Promise<void>((resolvePromise) => {
			const { waitUntilExit } = render(
				React.createElement(Onboarding, {
					existingConfig: existing ? {
						securityMode: existing.securityMode,
						workspaceDir: existing.workspaceDir,
						defaultModel: existing.defaultModel,
						modelAliases: existing.modelAliases,
						configuredProviders: configuredProviderNames,
					} : undefined,
					onComplete: async (result) => {
						// Store API keys
						for (const { provider, key } of result.keys) {
							addKey(provider, key);
						}

						// Save config
						const config: AppConfig = {
							securityMode: result.securityMode,
							workspaceDir: result.workspaceDir
								? resolvePath(result.workspaceDir)
								: undefined,
							apiEndpoint: { port: 3271, host: "127.0.0.1" },
							onboardingComplete: true,
							createdAt: new Date().toISOString(),
							defaultModel: result.defaultModel,
							modelAliases: result.modelAliases,
						};
						saveConfig(config);

						// Generate auth token
						getOrCreateAuthToken();

						// Record audit event
						recordAuditEvent({
							event: "mode_changed",
							details: {
								mode: result.securityMode,
								source: "onboarding",
							},
						});

						// Small delay to let the "done" screen render
						setTimeout(() => {
							resolvePromise();
						}, 500);
					},
				}),
			);

			waitUntilExit().then(() => resolvePromise());
		});
	});
