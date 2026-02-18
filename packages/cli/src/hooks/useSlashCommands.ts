import { useCallback } from "react";
import { nanoid } from "nanoid";
import type { ClientMessage } from "@tek/gateway";
import type { ChatMessage } from "../lib/gateway-client.js";
import {
	createUsageQueryMessage,
	createSessionListMessage,
	createContextInspectMessage,
} from "../lib/gateway-client.js";

export type SlashCommandResult = {
	handled: boolean;
	message?: ChatMessage;
	wsMessage?: ClientMessage;
	action?: "clear" | "quit" | "help" | "model-switch" | "proxy";
	/** Extracted model name for model-switch action */
	modelName?: string;
	/** Proxy command and args for proxy action */
	proxyCommand?: string;
	proxyArgs?: string[];
	/** Whether agent observation is enabled for proxy */
	proxyAgent?: boolean;
};

interface SlashCommandContext {
	sessionId: string | null;
	model: string;
}

function systemMessage(content: string): ChatMessage {
	return {
		id: nanoid(),
		type: "text",
		role: "system",
		content,
		timestamp: new Date().toISOString(),
	};
}

const HELP_TEXT = [
	"/model <name>    Switch model",
	"/session new     New session",
	"/session list    List sessions",
	"/context         Inspect context",
	"/usage           Show usage stats",
	"/tools           List available tools",
	"/approve <tool> <tier>  Set approval tier (auto/ask/deny)",
	"/clear           Clear screen",
	"/quit            Exit",
	"/proxy [--agent] <cmd>  Run interactive terminal app (--agent enables AI observation)",
	"/help            Show this help",
].join("\n");

/**
 * Hook for parsing and dispatching slash commands.
 * Returns processInput which checks if input is a slash command.
 */
export function useSlashCommands() {
	const processInput = useCallback(
		(input: string, context: SlashCommandContext): SlashCommandResult => {
			if (!input.startsWith("/")) {
				return { handled: false };
			}

			const parts = input.slice(1).split(/\s+/);
			const command = parts[0]?.toLowerCase();
			const args = parts.slice(1);

			switch (command) {
				case "help":
					return {
						handled: true,
						action: "help",
						message: systemMessage(HELP_TEXT),
					};

				case "model": {
					const name = args.join(" ").trim();
					if (!name) {
						return {
							handled: true,
							message: systemMessage(
								`Current model: ${context.model}\nUsage: /model <name>`,
							),
						};
					}
					return {
						handled: true,
						action: "model-switch",
						modelName: name,
						message: systemMessage(`Switched to model: ${name}`),
					};
				}

				case "session": {
					const sub = args[0]?.toLowerCase();
					if (sub === "new") {
						return {
							handled: true,
							message: systemMessage("Starting new session..."),
						};
					}
					if (sub === "list") {
						return {
							handled: true,
							wsMessage: createSessionListMessage(),
						};
					}
					return {
						handled: true,
						message: systemMessage(
							"Usage: /session new | /session list",
						),
					};
				}

				case "context": {
					if (!context.sessionId) {
						return {
							handled: true,
							message: systemMessage(
								"No active session. Send a message first.",
							),
						};
					}
					return {
						handled: true,
						wsMessage: createContextInspectMessage(context.sessionId),
					};
				}

				case "usage":
					return {
						handled: true,
						wsMessage: createUsageQueryMessage(
							context.sessionId ?? undefined,
						),
					};

				case "tools":
					return {
						handled: true,
						message: systemMessage(
							"Tool system is active. Tools are loaded from your tek.json configuration.\n" +
								"Built-in tools: bash, read_file, write_file, list_files\n" +
								"MCP tools: loaded from configured MCP servers\n" +
								"Use /approve <toolName> <tier> to set approval preferences.",
						),
					};

				case "approve": {
					const toolName = args[0];
					const tier = args[1]?.toLowerCase();
					if (!toolName || !tier) {
						return {
							handled: true,
							message: systemMessage(
								"Usage: /approve <toolName> <tier>\nTiers: auto (no approval), ask (always ask), deny (always deny)",
							),
						};
					}
					if (!["auto", "ask", "deny"].includes(tier)) {
						return {
							handled: true,
							message: systemMessage(
								`Invalid tier: ${tier}. Use auto, ask, or deny.`,
							),
						};
					}
					return {
						handled: true,
						message: systemMessage(
							`Approval preference set: ${toolName} -> ${tier}`,
						),
					};
				}

				case "proxy": {
					const agentFlag = args.includes("--agent");
					const filteredArgs = args.filter((a) => a !== "--agent");
					const cmd = filteredArgs[0];
					if (!cmd) {
						return {
							handled: true,
							message: systemMessage(
								"Usage: /proxy [--agent] <command> [args...]\nExample: /proxy --agent vim file.txt\n--agent enables agent terminal observation and input",
							),
						};
					}
					return {
						handled: true,
						action: "proxy",
						proxyCommand: cmd,
						proxyArgs: filteredArgs.slice(1),
						proxyAgent: agentFlag,
					};
				}

				case "clear":
					return { handled: true, action: "clear" };

				case "quit":
				case "exit":
					return { handled: true, action: "quit" };

				default:
					return {
						handled: true,
						message: systemMessage(
							`Unknown command: /${command}. Type /help for available commands.`,
						),
					};
			}
		},
		[],
	);

	return { processInput };
}
