import type { ServerMessage } from "@tek/gateway";

/** Escape HTML special characters for Telegram HTML parse_mode */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/** Convert markdown-style formatting to Telegram HTML */
export function markdownToTelegramHtml(text: string): string {
	return text
		.replace(/```(\w*)\n?([\s\S]*?)```/g, "<pre>$2</pre>")
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
		.replace(/\*([^*]+)\*/g, "<i>$1</i>")
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export interface FormattedMessage {
	text: string;
	replyMarkup?: unknown; // InlineKeyboard — typed loosely to avoid grammy import here
}

/**
 * Convert a gateway ServerMessage to a Telegram-formatted message.
 * Returns null for message types that should not be sent to Telegram
 * (e.g., stream deltas are accumulated separately).
 */
export function formatForTelegram(msg: ServerMessage): FormattedMessage | null {
	switch (msg.type) {
		case "chat.stream.start":
			return null; // Handled by accumulator
		case "chat.stream.delta":
			return null; // Handled by accumulator
		case "chat.stream.end":
			return null; // Handled by accumulator

		case "error":
			return { text: `<b>Error:</b> ${escapeHtml(msg.message)}` };

		case "session.created":
			return { text: `Session started: <code>${escapeHtml(msg.sessionId)}</code>` };

		case "tool.call":
			return {
				text: `<b>Tool Call:</b> <code>${escapeHtml(msg.toolName)}</code>\n`
					+ `<pre>${escapeHtml(JSON.stringify(msg.args, null, 2).slice(0, 500))}</pre>`,
			};

		case "tool.result":
			return {
				text: `<b>Tool Result:</b> <code>${escapeHtml(msg.toolName)}</code>\n`
					+ `<pre>${escapeHtml(String(msg.result).slice(0, 1000))}</pre>`,
			};

		// tool.approval.request handled separately with inline keyboard
		default:
			return null;
	}
}
