import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { discoverGateway } from "../lib/discovery.js";
import { Chat } from "../components/Chat.js";

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

		const { waitUntilExit } = render(
			React.createElement(Chat, {
				wsUrl,
				initialModel: options.model,
				resumeSessionId: options.session,
			}),
		);

		await waitUntilExit();
	});
