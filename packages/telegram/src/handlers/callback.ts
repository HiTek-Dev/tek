import type { Bot } from "grammy";
import { getConnectionState } from "@tek/gateway";
import { recordSessionApproval } from "@tek/gateway";
import { createLogger } from "@tek/core";

const logger = createLogger("telegram-callback");

/** Map from chatId to transportId for callback resolution */
const chatTransportMap = new Map<number, string>();

export function registerChatTransport(chatId: number, transportId: string): void {
	chatTransportMap.set(chatId, transportId);
}

export function registerCallbackHandlers(bot: Bot): void {
	// Tool approval callback: tool:approve:<toolCallId> or tool:deny:<toolCallId> or tool:session:<toolCallId>
	bot.callbackQuery(/^tool:(approve|deny|session):(.+)$/, async (ctx) => {
		const match = ctx.match!;
		const action = match[1]; // "approve" | "deny" | "session"
		const toolCallId = match[2];

		const chatId = ctx.callbackQuery.message?.chat?.id;
		if (!chatId) {
			await ctx.answerCallbackQuery({ text: "Error: unknown chat" });
			return;
		}

		const transportId = chatTransportMap.get(chatId);
		if (!transportId) {
			await ctx.answerCallbackQuery({ text: "Error: no active session" });
			return;
		}

		const connState = getConnectionState(transportId);
		if (!connState) {
			await ctx.answerCallbackQuery({ text: "Error: connection lost" });
			return;
		}

		const pending = connState.pendingApprovals.get(toolCallId);
		if (!pending) {
			await ctx.answerCallbackQuery({ text: "Approval expired or already handled" });
			return;
		}

		const approved = action !== "deny";

		// Session-approve: record so future calls skip approval
		if (action === "session" && connState.approvalPolicy) {
			recordSessionApproval(pending.toolName, connState.approvalPolicy);
			logger.info(`Session-approved tool "${pending.toolName}" via Telegram`);
		}

		pending.resolve(approved);

		await ctx.answerCallbackQuery({
			text: approved ? "Approved" : "Denied",
		});

		// Edit message to show decision
		const originalText = ctx.callbackQuery.message?.text ?? "";
		try {
			await ctx.editMessageText(
				`${originalText}\n\n<b>${approved ? "APPROVED" : "DENIED"}</b>`,
				{ parse_mode: "HTML" },
			);
		} catch {
			// Ignore edit failures
		}
	});
}
