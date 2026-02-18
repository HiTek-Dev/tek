import type { Bot } from "grammy";
import { markdownToTelegramHtml } from "../formatter.js";
import { createLogger } from "@tek/core";

const logger = createLogger("telegram-accumulator");

/** Maximum Telegram message length */
const MAX_MESSAGE_LENGTH = 4096;

/** Minimum interval between message edits (ms) */
const EDIT_INTERVAL_MS = 2000;

export class TelegramResponseAccumulator {
	private buffer = "";
	private messageId: number | null = null;
	private lastEditTime = 0;
	private pendingTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private chatId: number,
		private bot: Bot,
	) {}

	/** Append a text delta to the buffer and schedule a flush */
	async handleDelta(delta: string): Promise<void> {
		this.buffer += delta;

		const now = Date.now();
		if (now - this.lastEditTime >= EDIT_INTERVAL_MS) {
			await this.flush();
		} else if (!this.pendingTimer) {
			this.pendingTimer = setTimeout(
				() => this.flush().catch(() => {}),
				EDIT_INTERVAL_MS - (now - this.lastEditTime),
			);
		}
	}

	/** Flush buffered content to Telegram (send or edit) */
	async flush(): Promise<void> {
		if (!this.buffer.trim()) return;

		if (this.pendingTimer) {
			clearTimeout(this.pendingTimer);
			this.pendingTimer = null;
		}

		this.lastEditTime = Date.now();

		// Convert markdown to HTML for display
		const html = markdownToTelegramHtml(this.buffer);

		// Split if too long
		const chunks = splitMessage(html, MAX_MESSAGE_LENGTH);

		try {
			if (!this.messageId) {
				// Send initial message
				const sent = await this.bot.api.sendMessage(
					this.chatId,
					chunks[0],
					{ parse_mode: "HTML" },
				);
				this.messageId = sent.message_id;

				// Send overflow chunks as separate messages
				for (let i = 1; i < chunks.length; i++) {
					await this.bot.api.sendMessage(this.chatId, chunks[i], {
						parse_mode: "HTML",
					});
				}
			} else {
				// Edit existing message (only the first chunk -- overflow is rare mid-stream)
				await this.bot.api.editMessageText(
					this.chatId,
					this.messageId,
					chunks[0],
					{ parse_mode: "HTML" },
				).catch(() => {
					// Ignore "message not modified" errors
				});
			}
		} catch (err) {
			logger.error(`Telegram flush failed: ${err instanceof Error ? err.message : "unknown"}`);
		}
	}

	/** Final flush with complete response -- converts full text to HTML */
	async finalize(): Promise<void> {
		if (this.pendingTimer) {
			clearTimeout(this.pendingTimer);
			this.pendingTimer = null;
		}
		await this.flush();
		this.reset();
	}

	/** Reset accumulator state for next response */
	private reset(): void {
		this.buffer = "";
		this.messageId = null;
		this.lastEditTime = 0;
	}
}

/**
 * Split a message at paragraph boundaries to fit within maxLength.
 * Falls back to hard split if no paragraph break is available.
 */
function splitMessage(text: string, maxLength: number): string[] {
	if (text.length <= maxLength) return [text];

	const chunks: string[] = [];
	let remaining = text;

	while (remaining.length > maxLength) {
		// Try to split at paragraph boundary
		let splitIdx = remaining.lastIndexOf("\n\n", maxLength);
		if (splitIdx <= 0) {
			// Fall back to single newline
			splitIdx = remaining.lastIndexOf("\n", maxLength);
		}
		if (splitIdx <= 0) {
			// Hard split
			splitIdx = maxLength;
		}

		chunks.push(remaining.slice(0, splitIdx));
		remaining = remaining.slice(splitIdx).trimStart();
	}

	if (remaining) chunks.push(remaining);
	return chunks;
}
