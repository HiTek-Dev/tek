#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { configExists, CLI_COMMAND, DISPLAY_NAME, CONFIG_DIR_NAME } from "@tek/core";
import { keysCommand } from "./commands/keys.js";
import { initCommand } from "./commands/init.js";
import { configCommand } from "./commands/config.js";
import { auditCommand } from "./commands/audit.js";
import { chatCommand } from "./commands/chat.js";
import { gatewayCommand } from "./commands/gateway.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { discoverGateway } from "./lib/discovery.js";

// Migrate config from old location if present
const oldConfigDir = join(homedir(), ".config", "agentspace");
const newConfigDir = join(homedir(), ".config", CONFIG_DIR_NAME);
if (existsSync(oldConfigDir) && !existsSync(newConfigDir)) {
	renameSync(oldConfigDir, newConfigDir);
	const oldDb = join(newConfigDir, "agentspace.db");
	if (existsSync(oldDb)) {
		renameSync(oldDb, join(newConfigDir, "tek.db"));
	}
	console.log("Migrated config from ~/.config/agentspace to ~/.config/tek");
}

const program = new Command();

program
	.name(CLI_COMMAND)
	.version("0.1.0")
	.description(
		`${DISPLAY_NAME} - A self-hosted AI agent platform with secure credential management`,
	);

program.addCommand(keysCommand);
program.addCommand(initCommand);
program.addCommand(configCommand);
program.addCommand(auditCommand);
program.addCommand(chatCommand);
program.addCommand(gatewayCommand);
program.addCommand(uninstallCommand);

// Default action: auto-launch chat when configured and gateway is running
program.action(async () => {
	if (!configExists()) {
		console.log(
			chalk.yellow(
				`${DISPLAY_NAME} is not configured. Run "${CLI_COMMAND} init" to get started.`,
			),
		);
		return;
	}

	const gateway = discoverGateway();
	if (!gateway) {
		console.log(
			chalk.yellow(
				"Gateway is not running. Start it with:",
			),
		);
		console.log(chalk.cyan(`  ${CLI_COMMAND} gateway start`));
		console.log();
		program.help();
		return;
	}

	// Gateway is running and config exists — launch chat directly
	// Invoke the chat command's action programmatically
	await chatCommand.parseAsync([], { from: "user" });
});

program.parse();
