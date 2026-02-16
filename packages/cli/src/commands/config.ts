import { Command } from "commander";
import chalk from "chalk";
import {
	loadConfig,
	saveConfig,
	configExists,
	type SecurityMode,
} from "@agentspace/core";
import { recordAuditEvent } from "@agentspace/db";
import { getOrCreateAuthToken } from "../vault/index.js";
import { keychainSet } from "../vault/keychain.js";
import { generateAuthToken } from "@agentspace/core";

export const configCommand = new Command("config").description(
	"View and manage AgentSpace configuration",
);

configCommand
	.command("show")
	.description("Display current configuration")
	.action(() => {
		if (!configExists()) {
			console.log(
				chalk.yellow(
					'AgentSpace is not configured. Run "agentspace init" first.',
				),
			);
			return;
		}

		const config = loadConfig();
		if (!config) {
			console.log(chalk.red("Error: Failed to load configuration."));
			return;
		}

		console.log("\n" + chalk.bold("AgentSpace Configuration") + "\n");
		console.log(
			`  Security mode:      ${chalk.cyan(config.securityMode === "full-control" ? "Full Control" : "Limited Control")}`,
		);
		if (config.workspaceDir) {
			console.log(
				`  Workspace:          ${chalk.cyan(config.workspaceDir)}`,
			);
		}
		console.log(
			`  API endpoint:       ${chalk.cyan(`127.0.0.1:${config.apiEndpoint.port}`)}`,
		);
		console.log(
			`  Onboarding:         ${config.onboardingComplete ? chalk.green("complete") : chalk.yellow("incomplete")}`,
		);
		console.log(
			`  Created:            ${chalk.dim(config.createdAt)}`,
		);
		console.log();
	});

configCommand
	.command("set")
	.description("Change a configuration value")
	.argument("<key>", "Configuration key (mode)")
	.argument("<value>", "New value")
	.option("--workspace <dir>", "Workspace directory (required when switching to limited-control)")
	.action(
		(key: string, value: string, options: { workspace?: string }) => {
			if (!configExists()) {
				console.log(
					chalk.yellow(
						'AgentSpace is not configured. Run "agentspace init" first.',
					),
				);
				return;
			}

			if (key !== "mode") {
				console.log(
					chalk.red(
						`Unknown config key: "${key}". Currently supported: mode`,
					),
				);
				return;
			}

			const validModes: SecurityMode[] = [
				"full-control",
				"limited-control",
			];
			if (!validModes.includes(value as SecurityMode)) {
				console.log(
					chalk.red(
						`Invalid mode: "${value}". Valid modes: ${validModes.join(", ")}`,
					),
				);
				return;
			}

			const config = loadConfig();
			if (!config) {
				console.log(chalk.red("Error: Failed to load configuration."));
				return;
			}

			const newMode = value as SecurityMode;

			if (
				newMode === "limited-control" &&
				!config.workspaceDir &&
				!options.workspace
			) {
				console.log(
					chalk.red(
						"Limited Control mode requires a workspace directory. Use --workspace <dir> to set one.",
					),
				);
				return;
			}

			const oldMode = config.securityMode;
			config.securityMode = newMode;
			if (options.workspace) {
				config.workspaceDir = options.workspace;
			}

			saveConfig(config);

			recordAuditEvent({
				event: "mode_changed",
				details: { from: oldMode, to: newMode },
			});

			console.log(
				chalk.green(
					`Security mode changed from "${oldMode}" to "${newMode}"`,
				),
			);
		},
	);

configCommand
	.command("rotate-token")
	.description("Generate a new API endpoint auth token")
	.action(() => {
		const newToken = generateAuthToken();
		keychainSet("api-endpoint-token", newToken);

		recordAuditEvent({
			event: "token_rotated",
		});

		console.log(chalk.green("API endpoint auth token rotated."));
		console.log(
			chalk.yellow(
				"Warning: Applications using the old token will need to be updated.",
			),
		);
		console.log(`New token: ${chalk.dim(newToken)}`);
	});
