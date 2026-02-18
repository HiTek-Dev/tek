import { tool } from "ai";
import { z } from "zod";

/**
 * Create an image generation tool using Venice AI's image generation API.
 * Returns image data (base64) or error message.
 */
export function createVeniceImageTool(apiKey?: string) {
	return tool({
		description: apiKey
			? "Generate an image from a text description using Venice AI's image generation model."
			: "Venice AI image generation is unavailable (no API key configured).",
		inputSchema: z.object({
			prompt: z
				.string()
				.describe("Detailed description of the image to generate"),
			model: z
				.string()
				.optional()
				.default("fluently-xl")
				.describe("Venice AI image model to use"),
			width: z
				.number()
				.optional()
				.default(1024)
				.describe("Image width in pixels"),
			height: z
				.number()
				.optional()
				.default(1024)
				.describe("Image height in pixels"),
			negative_prompt: z
				.string()
				.optional()
				.describe("What to exclude from the image"),
			safe_mode: z
				.boolean()
				.optional()
				.default(false)
				.describe("Enable safe mode content filtering"),
		}),
		execute: async ({ prompt, model, width, height, negative_prompt, safe_mode }) => {
			if (!apiKey) {
				return { error: "Venice image generation unavailable: no Venice API key configured" };
			}

			try {
				const body: Record<string, unknown> = {
					model,
					prompt,
					width,
					height,
					safe_mode,
				};
				if (negative_prompt) {
					body.negative_prompt = negative_prompt;
				}

				const response = await fetch(
					"https://api.venice.ai/api/v1/image/generate",
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${apiKey}`,
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify(body),
					},
				);

				if (!response.ok) {
					const text = await response.text();
					return {
						error: `Venice image gen failed: ${response.status} ${text}`,
					};
				}

				const data = (await response.json()) as {
					images?: string[];
					id?: string;
				};

				return { images: data.images, id: data.id };
			} catch (err) {
				return {
					error: `Venice image gen failed: ${err instanceof Error ? err.message : String(err)}`,
				};
			}
		},
	});
}
