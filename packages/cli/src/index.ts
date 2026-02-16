#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { configExists } from "@agentspace/core";
import { keysCommand } from "./commands/keys.js";
import { initCommand } from "./commands/init.js";
import { configCommand } from "./commands/config.js";
import { auditCommand } from "./commands/audit.js";

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

// Default action: suggest init if not configured
program.action(() => {
	if (!configExists()) {
		console.log(
			chalk.yellow(
				'AgentSpace is not configured. Run "agentspace init" to get started.',
			),
		);
	} else {
		program.help();
	}
});

program.parse();
