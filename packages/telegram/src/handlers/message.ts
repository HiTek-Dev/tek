import type { Bot, Context } from "grammy";
import { nanoid } from "nanoid";
import { createLogger } from "@tek/core";
import {
	handleChatSend,
	initConnection,
	getConnectionState,
} from "@tek/gateway";
import type { ChatSend } from "@tek/gateway";
import { TelegramTransport } from "../transport.js";
import { getPairedUser } from "../auth/pairing.js";
import { registerChatTransport } from "./callback.js";

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
	logger.info(`[RECEIVED] Message from chat ${chatId}`);

	// Check if user is paired
	const paired = getPairedUser(chatId);
	logger.info(`[PAIRING] Chat ${chatId} paired: ${paired ? "yes" : "no"}`);
	if (!paired) {
		logger.info(`[REPLY] Sending pairing instruction to ${chatId}`);
		await ctx.reply(
			"Please pair first. Send /start for instructions.",
		);
		return;
	}

	const text = ctx.message?.text;
	logger.info(`[TEXT] Message text: "${text}"`);
	if (!text) {
		logger.info(`[TEXT] No text found, ignoring`);
		return;
	}

	// Get or create transport and connection state
	logger.info(`[TRANSPORT] Getting or creating transport for ${chatId}`);
	const transport = getOrCreateTransport(chatId, bot);
	logger.info(`[TRANSPORT] Transport ID: ${transport.transportId}`);
	registerChatTransport(chatId, transport.transportId);
	let connState = getConnectionState(transport.transportId);
	logger.info(`[CONNECTION] Existing connection: ${connState ? "yes" : "no"}`);
	if (!connState) {
		logger.info(`[CONNECTION] Creating new connection`);
		connState = initConnection(transport.transportId);
		logger.info(`[CONNECTION] New connection created, session: ${connState.sessionId}`);
	}

	// Guard against concurrent streams
	if (connState.streaming) {
		logger.info(`[STREAMING] Chat ${chatId} already streaming, sending wait message`);
		await ctx.reply("Still processing your previous message. Please wait.");
		await ctx.api.sendChatAction(chatId, "typing");
		return;
	}

	// Send typing indicator and keep it alive while processing
	logger.info(`[SENDING] Sending chat message to gateway`);
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
		logger.info(`[GATEWAY] Sending message to gateway (ID: ${chatSendMsg.id})`);
		await handleChatSend(transport, chatSendMsg, connState);
		logger.info(`[GATEWAY] Message sent successfully`);
	} catch (err) {
		logger.error(`[ERROR] Failed to send message to gateway: ${err instanceof Error ? err.message : String(err)}`);
		await ctx.reply("Error processing your message. Please try again.");
	} finally {
		clearInterval(typingInterval);
	}
}
