import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { discoverGateway } from "../lib/discovery.js";
import { Chat } from "../components/Chat.js";
import { runPtyProxy } from "../lib/pty-proxy.js";

export const chatCommand = new Command("chat")
	.description("Start a chat session with your agent")
	.option("-m, --model <model>", "Model to use")
	.option("-s, --session <id>", "Resume an existing session")
	.action(async (options: { model?: string; session?: string }) => {
		const gateway = discoverGateway();

		if (!gateway) {
			console.error(
				"Gateway is not running. Start it with: node packages/gateway/dist/index.js",
			);
			process.exit(1);
		}

		const wsUrl = `ws://127.0.0.1:${gateway.port}/gateway`;

		let pendingProxy: { command: string; args: string[] } | null = null as {
			command: string;
			args: string[];
		} | null;

		const { waitUntilExit } = render(
			React.createElement(Chat, {
				wsUrl,
				initialModel: options.model,
				resumeSessionId: options.session,
				onProxyRequest: (cmd: string, args: string[]) => {
					pendingProxy = { command: cmd, args };
				},
			}),
		);

		await waitUntilExit();

		if (pendingProxy) {
			console.log(
				`\n[proxy] Running: ${pendingProxy.command} ${pendingProxy.args.join(" ")}\n`,
			);
			const { exitCode } = await runPtyProxy({
				command: pendingProxy.command,
				args: pendingProxy.args,
			});
			console.log(`\n[proxy] Process exited with code ${exitCode}`);
			console.log("Type 'agentspace chat' to resume your session.\n");
			process.exit(exitCode);
		}
	});
