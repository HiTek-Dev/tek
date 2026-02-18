import { eq, sql } from "drizzle-orm";
import { getDb, usageRecords } from "@tek/db";

export interface UsageRecord {
	sessionId: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	cost: number;
	timestamp: string;
}

export interface UsageRow extends UsageRecord {
	id: number;
}

export interface UsageTotals {
	perModel: Record<
		string,
		{
			inputTokens: number;
			outputTokens: number;
			totalTokens: number;
			totalCost: number;
			requestCount: number;
		}
	>;
	grandTotal: {
		totalCost: number;
		totalTokens: number;
		requestCount: number;
	};
}

/**
 * Record a usage entry in the database.
 */
export function recordUsage(record: UsageRecord): void {
	const db = getDb();
	db.insert(usageRecords)
		.values({
			sessionId: record.sessionId,
			model: record.model,
			inputTokens: record.inputTokens,
			outputTokens: record.outputTokens,
			totalTokens: record.totalTokens,
			cost: record.cost,
			timestamp: record.timestamp,
		})
		.run();
}

/**
 * Get all usage records for a specific session.
 */
export function getUsageBySession(sessionId: string): UsageRow[] {
	const db = getDb();
	const rows = db
		.select()
		.from(usageRecords)
		.where(eq(usageRecords.sessionId, sessionId))
		.all();

	return rows.map((r) => ({
		id: r.id,
		sessionId: r.sessionId,
		model: r.model,
		inputTokens: r.inputTokens,
		outputTokens: r.outputTokens,
		totalTokens: r.totalTokens,
		cost: r.cost,
		timestamp: r.timestamp,
	}));
}

/**
 * Get aggregated usage totals grouped by model.
 */
export function getUsageTotals(): UsageTotals {
	const db = getDb();

	const rows = db
		.select({
			model: usageRecords.model,
			inputTokens: sql<number>`SUM(${usageRecords.inputTokens})`,
			outputTokens: sql<number>`SUM(${usageRecords.outputTokens})`,
			totalTokens: sql<number>`SUM(${usageRecords.totalTokens})`,
			totalCost: sql<number>`SUM(${usageRecords.cost})`,
			requestCount: sql<number>`COUNT(*)`,
		})
		.from(usageRecords)
		.groupBy(usageRecords.model)
		.all();

	const perModel: UsageTotals["perModel"] = {};
	let grandTotalCost = 0;
	let grandTotalTokens = 0;
	let grandTotalRequests = 0;

	for (const row of rows) {
		perModel[row.model] = {
			inputTokens: row.inputTokens,
			outputTokens: row.outputTokens,
			totalTokens: row.totalTokens,
			totalCost: row.totalCost,
			requestCount: row.requestCount,
		};
		grandTotalCost += row.totalCost;
		grandTotalTokens += row.totalTokens;
		grandTotalRequests += row.requestCount;
	}

	return {
		perModel,
		grandTotal: {
			totalCost: grandTotalCost,
			totalTokens: grandTotalTokens,
			requestCount: grandTotalRequests,
		},
	};
}
