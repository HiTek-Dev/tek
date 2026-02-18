#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { configExists } from "@tek/core";
import { keysCommand } from "./commands/keys.js";
import { initCommand } from "./commands/init.js";
import { configCommand } from "./commands/config.js";
import { auditCommand } from "./commands/audit.js";
import { chatCommand } from "./commands/chat.js";
import { discoverGateway } from "./lib/discovery.js";

const program = new Command();

program
	.name("agentspace")
	.version("0.1.0")
	.description(
		"AgentSpace - A self-hosted AI agent platform with secure credential management",
	);

program.addCommand(keysCommand);
program.addCommand(initCommand);
program.addCommand(configCommand);
program.addCommand(auditCommand);
program.addCommand(chatCommand);

// Default action: auto-launch chat when configured and gateway is running
program.action(async () => {
	if (!configExists()) {
		console.log(
			chalk.yellow(
				'AgentSpace is not configured. Run "agentspace init" to get started.',
			),
		);
		return;
	}

	const gateway = discoverGateway();
	if (!gateway) {
		console.log(
			chalk.yellow(
				"Gateway is not running. Start the gateway first, then use:",
			),
		);
		console.log(chalk.cyan("  agentspace chat"));
		console.log();
		program.help();
		return;
	}

	// Gateway is running and config exists — launch chat directly
	// Invoke the chat command's action programmatically
	await chatCommand.parseAsync([], { from: "user" });
});

program.parse();
