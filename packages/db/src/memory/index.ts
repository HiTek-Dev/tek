export {
	appendDailyLog,
	loadRecentLogs,
	getTodayLogPath,
	getYesterdayLogPath,
} from "./daily-logger.js";

export {
	loadLongTermMemory,
	addMemoryEntry,
	getMemoryPath,
} from "./memory-curator.js";
export type { MemorySection } from "./memory-curator.js";

export {
	loadSoul,
	evolveSoul,
	getSoulPath,
} from "./soul-manager.js";

export {
	generateEmbedding,
	generateEmbeddings,
	storeEmbedding,
	embedAndStore,
	EMBEDDING_DIMS,
} from "./embeddings.js";

export { searchMemories } from "./vector-search.js";
export type { SearchResult } from "./vector-search.js";
