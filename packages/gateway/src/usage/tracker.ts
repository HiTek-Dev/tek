import { createLogger } from "@tek/core";
import {
	recordUsage,
	getUsageBySession,
	getUsageTotals,
	type UsageRecord,
	type UsageRow,
	type UsageTotals,
} from "./store.js";

const logger = createLogger("usage-tracker");

/**
 * UsageTracker wraps the usage store functions with logging.
 */
export class UsageTracker {
	/**
	 * Record a usage entry for a completed LLM request.
	 */
	record(data: UsageRecord): void {
		recordUsage(data);
		logger.info(
			`Usage recorded: ${data.model} - ${data.totalTokens} tokens, $${data.cost.toFixed(6)}`,
		);
	}

	/**
	 * Query usage records for a specific session.
	 */
	querySession(sessionId: string): UsageRow[] {
		return getUsageBySession(sessionId);
	}

	/**
	 * Query aggregated usage totals across all sessions.
	 */
	queryTotals(): UsageTotals {
		return getUsageTotals();
	}
}

/** Singleton usage tracker instance. */
export const usageTracker = new UsageTracker();
