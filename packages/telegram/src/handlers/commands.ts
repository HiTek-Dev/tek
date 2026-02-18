import type { Bot, CommandContext, Context } from "grammy";
import { DISPLAY_NAME, CLI_COMMAND } from "@tek/core";
import { getPairedUser, generatePairingCode } from "../auth/pairing.js";

/**
 * Register /start and /pair command handlers on the bot.
 */
export function registerCommands(bot: Bot): void {
	bot.command("start", handleStart);
	bot.command("pair", handlePair);
}

/**
 * /start handler: greet paired users or show pairing code for new users.
 */
async function handleStart(ctx: CommandContext<Context>): Promise<void> {
	const chatId = ctx.chat.id;
	const paired = getPairedUser(chatId);

	if (paired && paired.active) {
		await ctx.reply(
			`You're connected to ${DISPLAY_NAME}. Send a message to chat with your agent.`,
		);
		return;
	}

	const code = generatePairingCode(chatId, ctx.from?.username ?? null);
	await ctx.reply(
		`Welcome to ${DISPLAY_NAME}! Your pairing code is: <code>${code}</code>\n\nEnter this code in your CLI: ${CLI_COMMAND} pair telegram ${code}\n\nCode expires in 1 hour.`,
		{ parse_mode: "HTML" },
	);
}

/**
 * /pair handler: generate a new pairing code (for new or re-pairing users).
 */
async function handlePair(ctx: CommandContext<Context>): Promise<void> {
	const chatId = ctx.chat.id;
	const code = generatePairingCode(chatId, ctx.from?.username ?? null);
	await ctx.reply(
		`Your pairing code is: <code>${code}</code>\n\nEnter this code in your CLI: ${CLI_COMMAND} pair telegram ${code}\n\nCode expires in 1 hour.`,
		{ parse_mode: "HTML" },
	);
}
