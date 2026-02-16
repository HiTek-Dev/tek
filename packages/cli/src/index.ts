#!/usr/bin/env node

import { Command } from "commander";
import { keysCommand } from "./commands/keys.js";

const program = new Command();

program
	.name("agentspace")
	.version("0.1.0")
	.description(
		"AgentSpace - A self-hosted AI agent platform with secure credential management",
	);

program.addCommand(keysCommand);

program.parse();
