import { Command } from "commander";
import React from "react";
import { render, Box, Text } from "ink";
import WebSocket from "ws";
import { nanoid } from "nanoid";
import { CLI_COMMAND, loadConfig, configExists, type AgentDefinition } from "@tek/core";
import { Select } from "@inkjs/ui";
import { discoverGateway } from "../lib/discovery.js";
import { Chat } from "../components/Chat.js";
import { runPtyProxy } from "../lib/pty-proxy.js";

/**
 * Pick an agent from a list using an interactive Ink Select component.
 */
async function pickAgent(agents: AgentDefinition[]): Promise<string> {
	return new Promise((resolve) => {
		const options = agents.map((a) => ({
			label: `${a.name ?? a.id} — ${a.purpose ?? a.description ?? a.id}`,
			value: a.id,
		}));

		const { unmount } = render(
			React.createElement(
				Box,
				{ flexDirection: "column", padding: 1 },
				React.createElement(Text, { bold: true }, "Select an agent to chat with:"),
				React.createElement(Select, {
					options,
					onChange: (value: string) => {
						unmount();
						resolve(value);
					},
				}),
			),
		);
	});
}

/**
 * Resolve agentId from --agent flag, auto-select for single agent, or interactive picker.
 * Returns undefined for legacy mode (zero agents).
 */
async function resolveAgentId(explicitAgent?: string): Promise<string | undefined> {
	if (!configExists()) return undefined;
	const config = loadConfig();
	const agents = config?.agents?.list ?? [];

	if (explicitAgent) {
		// Try exact ID match first
		const byId = agents.find((a) => a.id === explicitAgent);
		if (byId) return byId.id;

		// Try case-insensitive name match
		const byName = agents.find(
			(a) => a.name?.toLowerCase() === explicitAgent.toLowerCase(),
		);
		if (byName) return byName.id;

		// Not found
		console.error(
			`Agent "${explicitAgent}" not found. Available agents: ${agents.map((a) => a.name ?? a.id).join(", ") || "(none)"}`,
		);
		process.exit(1);
	}

	// No --agent flag
	if (agents.length === 0) {
		console.log(
			`No agents configured. Run '${CLI_COMMAND} onboard' to create your first agent.`,
		);
		process.exit(0);
	}

	if (agents.length === 1) {
		const agent = agents[0];
		console.log(`Using agent: ${agent.name ?? agent.id}`);
		return agent.id;
	}

	// Multiple agents: interactive picker
	return pickAgent(agents);
}

export const chatCommand = new Command("chat")
	.description("Start a chat session with your agent")
	.option("-m, --model <model>", "Model to use")
	.option("-s, --session <id>", "Resume an existing session")
	.option("-a, --agent <id>", "Agent to chat with")
	.action(async (options: { model?: string; session?: string; agent?: string }) => {
		const gateway = discoverGateway();

		if (!gateway) {
			console.error(
				"Gateway is not running. Start it with: node packages/gateway/dist/index.js",
			);
			process.exit(1);
		}

		const wsUrl = `ws://127.0.0.1:${gateway.port}/gateway`;

		// Resolve agent before rendering Chat
		const agentId = await resolveAgentId(options.agent);

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
				agentId,
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
