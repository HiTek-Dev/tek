import type { Bot, Context } from "grammy";
import { nanoid } from "nanoid";
import { createLogger } from "@agentspace/core";
import {
	handleChatSend,
	initConnection,
	getConnectionState,
} from "@agentspace/gateway";
import type { ChatSend } from "@agentspace/gateway";
import { TelegramTransport } from "../transport.js";
import { getPairedUser } from "../auth/pairing.js";

const logger = createLogger("telegram-message");

/**
 * Module-level map: reuse TelegramTransport instances across messages from the same user.
 */
const transports = new Map<number, TelegramTransport>();

/**
 * Get or create a TelegramTransport for a given chat.
 */
function getOrCreateTransport(chatId: number, bot: Bot): TelegramTransport {
	let transport = transports.get(chatId);
	if (!transport) {
		transport = new TelegramTransport(chatId, bot);
		transports.set(chatId, transport);
	}
	return transport;
}

/**
 * Handle incoming text messages from Telegram.
 * Bridges authenticated messages to the gateway's handleChatSend flow.
 */
export async function handleTelegramMessage(
	ctx: Context,
	bot: Bot,
): Promise<void> {
	const chatId = ctx.chat!.id;

	// Check if user is paired
	const paired = getPairedUser(chatId);
	if (!paired) {
		await ctx.reply(
			"Please pair first. Send /start for instructions.",
		);
		return;
	}

	const text = ctx.message?.text;
	if (!text) return;

	// Get or create transport and connection state
	const transport = getOrCreateTransport(chatId, bot);
	let connState = getConnectionState(transport.transportId);
	if (!connState) {
		connState = initConnection(transport.transportId);
	}

	// Guard against concurrent streams
	if (connState.streaming) {
		await ctx.reply("Still processing your previous message. Please wait.");
		await ctx.api.sendChatAction(chatId, "typing");
		return;
	}

	// Send typing indicator and keep it alive while processing
	await ctx.api.sendChatAction(chatId, "typing").catch(() => {});
	const typingInterval = setInterval(() => {
		bot.api.sendChatAction(chatId, "typing").catch(() => {});
	}, 4000);

	// Construct ChatSend message and route through gateway
	const chatSendMsg: ChatSend = {
		type: "chat.send",
		id: nanoid(),
		content: text,
		sessionId: connState.sessionId ?? undefined,
	};

	try {
		await handleChatSend(transport, chatSendMsg, connState);
	} finally {
		clearInterval(typingInterval);
	}
}
