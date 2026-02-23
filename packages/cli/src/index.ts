#!/usr/bin/env node

// Suppress deprecation warning about punycode module used by transitive dependencies
// Listen for warnings and filter out the punycode one before it's displayed
process.on("warning", (warning) => {
	if (
		typeof warning === "object" &&
		warning.message &&
		warning.message.includes("punycode")
	) {
		// Silently ignore punycode deprecation warnings
		return;
	}
	// Re-emit other warnings normally
	process.stderr.write(`${warning.name}: ${warning.message}\n`);
	if (warning.stack) {
		process.stderr.write(warning.stack + "\n");
	}
});

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
import { onboardCommand } from "./commands/onboard.js";
import { debugCommand } from "./commands/debug.js";
import { pairCommand } from "./commands/pair.js";
import { approveCommand, disapproveCommand } from "./commands/approve.js";
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
	.version("0.0.34")
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
program.addCommand(onboardCommand);
program.addCommand(debugCommand);
program.addCommand(pairCommand);
program.addCommand(approveCommand);
program.addCommand(disapproveCommand);

program.parse(process.argv);

// Only auto-launch chat if no arguments were provided (i.e., just `tek` with no command)
if (process.argv.length === 2) {
	if (!configExists()) {
		console.log(
			chalk.yellow(
				`${DISPLAY_NAME} is not configured. Run "${CLI_COMMAND} init" to get started.`,
			),
		);
		process.exit(0);
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
		process.exit(0);
	}

	// Gateway is running and config exists — launch chat directly
	// Invoke the chat command's action programmatically
	(async () => {
		await chatCommand.parseAsync([], { from: "user" });
	})();
}
