import { tool } from "ai";
import { z } from "zod";

/**
 * Create an HTTP fetch tool for making web requests.
 * Supports GET, POST, PUT, PATCH, DELETE methods with configurable headers and body.
 */
export function createFetchTool() {
	return tool({
		description:
			"Make an HTTP request to a URL. Supports GET, POST, PUT, PATCH, DELETE methods. Returns the response status, headers, and body.",
		inputSchema: z.object({
			url: z.string().url().describe("The URL to fetch"),
			method: z
				.enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
				.optional()
				.default("GET")
				.describe("HTTP method"),
			headers: z
				.record(z.string(), z.string())
				.optional()
				.describe("Optional request headers"),
			body: z
				.string()
				.optional()
				.describe("Optional request body (for POST/PUT/PATCH)"),
		}),
		execute: async ({ url, method, headers, body }) => {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout
			try {
				const response = await fetch(url, {
					method,
					headers,
					body:
						body && ["POST", "PUT", "PATCH"].includes(method)
							? body
							: undefined,
					signal: controller.signal,
				});
				const responseBody = await response.text();
				// Truncate large responses
				const maxSize = 100 * 1024; // 100KB
				const truncated =
					responseBody.length > maxSize
						? responseBody.slice(0, maxSize) +
							`\n\n[TRUNCATED: response is ${responseBody.length} bytes, showing first ${maxSize} bytes]`
						: responseBody;
				return {
					status: response.status,
					statusText: response.statusText,
					headers: Object.fromEntries(response.headers.entries()),
					body: truncated,
				};
			} catch (err) {
				return {
					error: err instanceof Error ? err.message : String(err),
				};
			} finally {
				clearTimeout(timeout);
			}
		},
	});
}
