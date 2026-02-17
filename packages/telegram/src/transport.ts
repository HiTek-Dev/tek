import type { Bot } from "grammy";
import type { Transport } from "@agentspace/gateway";
import type { ServerMessage } from "@agentspace/gateway";
import { formatForTelegram } from "./formatter.js";
import { TelegramResponseAccumulator } from "./streaming/accumulator.js";
import { createLogger } from "@agentspace/core";

const logger = createLogger("telegram-transport");

/**
 * TelegramTransport sends gateway ServerMessages to a Telegram chat.
 * Implements the Transport interface so gateway handlers are channel-agnostic.
 */
export class TelegramTransport implements Transport {
	readonly channel = "telegram" as const;
	readonly transportId: string;

	/** Per-request accumulators for streaming responses */
	private accumulators = new Map<string, TelegramResponseAccumulator>();

	constructor(
		private chatId: number,
		private bot: Bot,
	) {
		this.transportId = `tg:${chatId}`;
	}

	send(msg: ServerMessage): void {
		// Handle streaming messages via accumulator
		if (msg.type === "chat.stream.start") {
			const accumulator = new TelegramResponseAccumulator(this.chatId, this.bot);
			this.accumulators.set(msg.requestId, accumulator);
			// Send typing indicator
			this.bot.api.sendChatAction(this.chatId, "typing").catch(() => {});
			return;
		}

		if (msg.type === "chat.stream.delta") {
			const accumulator = this.accumulators.get(msg.requestId);
			if (accumulator) {
				accumulator.handleDelta(msg.delta).catch(() => {});
			}
			return;
		}

		if (msg.type === "chat.stream.end") {
			const accumulator = this.accumulators.get(msg.requestId);
			if (accumulator) {
				accumulator.finalize().catch(() => {});
				this.accumulators.delete(msg.requestId);
			}
			return;
		}

		// All other message types pass through to formatter
		const formatted = formatForTelegram(msg);
		if (formatted) {
			this.bot.api.sendMessage(this.chatId, formatted.text, {
				parse_mode: "HTML",
				...(formatted.replyMarkup ? { reply_markup: formatted.replyMarkup as any } : {}),
			}).catch((err: Error) => {
				logger.error(`Telegram send failed for chat ${this.chatId}: ${err.message}`);
			});
		}
	}

	/** Get the Telegram chat ID (for direct API calls like editMessage) */
	getChatId(): number {
		return this.chatId;
	}

	/** Get the bot instance (for direct API calls) */
	getBot(): Bot {
		return this.bot;
	}
}
