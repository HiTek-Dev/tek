/**
 * Ollama discovery client for probing Ollama servers and listing available models.
 *
 * Uses the native /api/tags endpoint for richer metadata (parameter_size, quantization_level, family).
 * Falls back to /v1/models (OpenAI-compatible) if /api/tags is unavailable.
 * All functions are safe — they never throw, returning empty results on failure.
 */

export interface OllamaModel {
	name: string;
	model: string;
	modified_at: string;
	size: number;
	digest: string;
	details: {
		format: string;
		family: string;
		families: string[];
		parameter_size: string;
		quantization_level: string;
	};
}

export interface OllamaTagsResponse {
	models: OllamaModel[];
}

/**
 * Probe an Ollama server for available models.
 * Uses the native /api/tags endpoint for richer metadata.
 * Falls back to /v1/models (OpenAI-compatible) if /api/tags fails.
 *
 * @param baseUrl - Ollama server base URL (without /v1 suffix)
 * @param timeoutMs - Timeout in milliseconds for each probe attempt
 * @returns Array of discovered models, or empty array if unreachable
 */
export async function listOllamaModels(
	baseUrl = "http://localhost:11434",
	timeoutMs = 3000,
): Promise<OllamaModel[]> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		// Try native API first (richer metadata)
		const res = await fetch(`${baseUrl}/api/tags`, {
			signal: controller.signal,
		});
		if (res.ok) {
			const data: OllamaTagsResponse = await res.json();
			return data.models;
		}
	} catch {
		// Fall through to OpenAI-compat endpoint
	} finally {
		clearTimeout(timer);
	}

	// Fallback: OpenAI-compatible endpoint
	const controller2 = new AbortController();
	const timer2 = setTimeout(() => controller2.abort(), timeoutMs);
	try {
		const res = await fetch(`${baseUrl}/v1/models`, {
			signal: controller2.signal,
		});
		if (res.ok) {
			const data = await res.json();
			// Convert OpenAI format to OllamaModel shape
			return (data.data ?? []).map((m: { id: string }) => ({
				name: m.id,
				model: m.id,
				modified_at: "",
				size: 0,
				digest: "",
				details: {
					format: "unknown",
					family: "unknown",
					families: [],
					parameter_size: "unknown",
					quantization_level: "unknown",
				},
			}));
		}
	} catch {
		// Ollama not reachable
	} finally {
		clearTimeout(timer2);
	}

	return [];
}

/**
 * Check if an Ollama server is reachable.
 *
 * @param baseUrl - Ollama server base URL (without /v1 suffix)
 * @param timeoutMs - Timeout in milliseconds
 * @returns true if the server responds successfully, false otherwise
 */
export async function isOllamaReachable(
	baseUrl = "http://localhost:11434",
	timeoutMs = 2000,
): Promise<boolean> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(`${baseUrl}/api/tags`, {
			signal: controller.signal,
		});
		return res.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}
