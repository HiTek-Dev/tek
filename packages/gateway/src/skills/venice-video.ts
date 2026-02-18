import { tool } from "ai";
import { z } from "zod";

/**
 * Create a video generation tool using Venice AI's video generation API.
 * Uses a two-step queue/poll pattern: queue a job, then poll for completion.
 */
export function createVeniceVideoTool(apiKey?: string) {
	return tool({
		description: apiKey
			? "Generate a video from a text description using Venice AI's video generation model."
			: "Venice AI video generation is unavailable (no API key configured).",
		inputSchema: z.object({
			prompt: z
				.string()
				.describe("Detailed description of the video to generate"),
			model: z
				.string()
				.optional()
				.describe("Venice AI video model to use"),
			duration: z
				.number()
				.optional()
				.describe("Video duration in seconds"),
			resolution: z
				.enum(["1K", "2K", "4K"])
				.optional()
				.describe("Video resolution"),
		}),
		execute: async ({ prompt, model, duration, resolution }) => {
			if (!apiKey) {
				return { error: "Venice video generation unavailable: no Venice API key configured" };
			}

			try {
				// Step 1: Queue the video generation job
				const queueBody: Record<string, unknown> = { prompt };
				if (model) queueBody.model = model;
				if (duration) queueBody.duration = duration;
				if (resolution) queueBody.resolution = resolution;

				const queueResponse = await fetch(
					"https://api.venice.ai/api/v1/video/queue",
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${apiKey}`,
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify(queueBody),
					},
				);

				if (!queueResponse.ok) {
					const text = await queueResponse.text();
					return {
						error: `Video queue failed: ${queueResponse.status} ${text}`,
					};
				}

				const queueData = (await queueResponse.json()) as {
					queue_id?: string;
				};
				const queueId = queueData.queue_id;

				if (!queueId) {
					return { error: "Video queue failed: no queue_id returned" };
				}

				// Step 2: Poll for completion (every 10s, max 30 attempts = 5 minutes)
				const maxAttempts = 30;
				const pollInterval = 10_000;

				for (let attempt = 0; attempt < maxAttempts; attempt++) {
					await new Promise((resolve) => setTimeout(resolve, pollInterval));

					const pollResponse = await fetch(
						"https://api.venice.ai/api/v1/video/retrieve",
						{
							method: "POST",
							headers: {
								Authorization: `Bearer ${apiKey}`,
								"Content-Type": "application/json",
								Accept: "application/json",
							},
							body: JSON.stringify({ queue_id: queueId }),
						},
					);

					if (!pollResponse.ok) {
						continue; // Retry on transient errors
					}

					const pollData = (await pollResponse.json()) as {
						status?: string;
						video_url?: string;
					};

					if (pollData.status === "completed" && pollData.video_url) {
						return {
							queue_id: queueId,
							status: "completed" as const,
							video_url: pollData.video_url,
						};
					}

					if (pollData.status === "failed") {
						return {
							error: `Video generation failed for queue_id: ${queueId}`,
						};
					}
				}

				// Timeout: still processing
				return {
					queue_id: queueId,
					status: "pending" as const,
					message: "Video still processing. Use queue_id to check later.",
				};
			} catch (err) {
				return {
					error: `Venice video gen failed: ${err instanceof Error ? err.message : String(err)}`,
				};
			}
		},
	});
}
