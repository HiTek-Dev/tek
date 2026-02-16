import {
	loadSoul,
	loadLongTermMemory,
	loadRecentLogs,
	searchMemories,
	embedAndStore,
	appendDailyLog,
} from "@agentspace/db";
import type { SearchResult } from "@agentspace/db";

/**
 * Orchestrates all memory operations: context building, semantic search,
 * memory storage, and pressure-triggered daily log flushes.
 */
export class MemoryManager {
	/**
	 * Build memory context for the assembler.
	 * Loads soul personality, long-term memory facts, and recent daily logs.
	 */
	getMemoryContext(): {
		soul: string;
		longTermMemory: string;
		recentLogs: string;
	} {
		return {
			soul: loadSoul(),
			longTermMemory: loadLongTermMemory(),
			recentLogs: loadRecentLogs(),
		};
	}

	/**
	 * Semantic search over stored memories using vector similarity.
	 */
	async search(
		query: string,
		opts?: { topK?: number; threadId?: string },
	): Promise<SearchResult[]> {
		return searchMemories(query, opts);
	}

	/**
	 * Store a new memory with embedding for future semantic search.
	 */
	async storeMemory(
		content: string,
		opts: {
			threadId?: string;
			memoryType: "fact" | "preference" | "decision" | "summary";
			source?: string;
		},
	): Promise<void> {
		await embedAndStore(content, opts);
	}

	/**
	 * Flush content to today's daily log (used during memory pressure).
	 * Preserves important information before context compaction.
	 */
	async flushToDaily(content: string): Promise<void> {
		appendDailyLog(content);
	}
}
