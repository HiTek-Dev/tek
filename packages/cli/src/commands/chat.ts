import { Command } from "commander";
import React from "react";
import { render } from "ink";
import WebSocket from "ws";
import { nanoid } from "nanoid";
import { CLI_COMMAND } from "@tek/core";
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

		let pendingProxy: { command: string; args: string[]; agent: boolean } | null = null as {
			command: string;
			args: string[];
			agent: boolean;
		} | null;

		const { waitUntilExit } = render(
			React.createElement(Chat, {
				wsUrl,
				initialModel: options.model,
				resumeSessionId: options.session,
				onProxyRequest: (cmd: string, args: string[], agent: boolean) => {
					pendingProxy = { command: cmd, args, agent };
				},
			}),
		);

		await waitUntilExit();

		if (pendingProxy) {
			const isAgent = pendingProxy.agent;
			const label = isAgent ? "[proxy:agent]" : "[proxy]";
			console.log(
				`\n${label} Running: ${pendingProxy.command} ${pendingProxy.args.join(" ")}\n`,
			);

			if (isAgent) {
				// Agent observation mode: open a separate WS connection for terminal messages
				const ws = new WebSocket(wsUrl);
				await new Promise<void>((resolve, reject) => {
					ws.on("open", () => resolve());
					ws.on("error", (err) => reject(err));
				});

				// Track agent input listeners for cleanup
				const agentInputListeners: ((data: string) => void)[] = [];

				ws.on("message", (raw: WebSocket.RawData) => {
					try {
						const msg = JSON.parse(
							typeof raw === "string" ? raw : raw.toString("utf-8"),
						);
						if (msg.type === "terminal.input" && agentInputListeners.length > 0) {
							for (const listener of agentInputListeners) {
								listener(msg.data);
							}
						}
					} catch {
						// Ignore non-JSON messages
					}
				});

				// Send terminal.control.grant on start
				ws.send(JSON.stringify({
					type: "terminal.control.grant",
					id: nanoid(),
					sessionId: options.session ?? "default",
				}));

				const { exitCode } = await runPtyProxy({
					command: pendingProxy.command,
					args: pendingProxy.args,
					onSnapshot: (content: string) => {
						if (ws.readyState === WebSocket.OPEN) {
							ws.send(JSON.stringify({
								type: "terminal.snapshot",
								id: nanoid(),
								sessionId: options.session ?? "default",
								content,
								timestamp: Date.now(),
							}));
						}
					},
					onAgentInput: (handler: (data: string) => void) => {
						agentInputListeners.push(handler);
						return () => {
							const idx = agentInputListeners.indexOf(handler);
							if (idx >= 0) agentInputListeners.splice(idx, 1);
						};
					},
					onControlRevoke: () => {
						if (ws.readyState === WebSocket.OPEN) {
							ws.send(JSON.stringify({
								type: "terminal.control.revoke",
								id: nanoid(),
								sessionId: options.session ?? "default",
							}));
						}
					},
				});

				// Clean up WS connection
				if (ws.readyState === WebSocket.OPEN) {
					ws.close();
				}

				console.log(`\n${label} Process exited with code ${exitCode}`);
				console.log(`Type '${CLI_COMMAND} chat' to resume your session.\n`);
				process.exit(exitCode);
			} else {
				// Standard proxy mode (no agent observation)
				const { exitCode } = await runPtyProxy({
					command: pendingProxy.command,
					args: pendingProxy.args,
				});
				console.log(`\n[proxy] Process exited with code ${exitCode}`);
				console.log(`Type '${CLI_COMMAND} chat' to resume your session.\n`);
				process.exit(exitCode);
			}
		}
	});
