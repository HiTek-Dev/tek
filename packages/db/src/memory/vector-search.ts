import { getDb } from "../connection.js";
import { generateEmbedding } from "./embeddings.js";

export interface SearchResult {
	id: number;
	content: string;
	memoryType: string;
	distance: number;
	createdAt: string;
}

/**
 * Perform KNN semantic search over vec_memories with metadata join.
 * Generates an embedding for the query text, then uses sqlite-vec
 * to find the closest matches and joins with the memories table.
 */
export async function searchMemories(
	query: string,
	opts?: { topK?: number; threadId?: string },
): Promise<SearchResult[]> {
	const topK = opts?.topK ?? 10;

	// Generate embedding for the query
	const { embedding } = await generateEmbedding(query);
	const blob = new Uint8Array(new Float32Array(embedding).buffer);

	const db = getDb();
	const sqlite = (db as any).$client;

	// KNN search with metadata join
	if (opts?.threadId) {
		const rows = sqlite
			.prepare(
				`WITH knn_matches AS (
					SELECT memory_id, distance
					FROM vec_memories
					WHERE content_embedding MATCH ?
						AND k = ?
				)
				SELECT m.id, m.content, m.memory_type AS memoryType, m.created_at AS createdAt, knn.distance
				FROM knn_matches knn
				LEFT JOIN memories m ON m.id = knn.memory_id
				WHERE m.thread_id = ?
				ORDER BY knn.distance ASC`,
			)
			.all(blob, topK, opts.threadId) as SearchResult[];
		return rows;
	}

	const rows = sqlite
		.prepare(
			`WITH knn_matches AS (
				SELECT memory_id, distance
				FROM vec_memories
				WHERE content_embedding MATCH ?
					AND k = ?
			)
			SELECT m.id, m.content, m.memory_type AS memoryType, m.created_at AS createdAt, knn.distance
			FROM knn_matches knn
			LEFT JOIN memories m ON m.id = knn.memory_id
			ORDER BY knn.distance ASC`,
		)
		.all(blob, topK) as SearchResult[];
	return rows;
}
