import { streamText, type ModelMessage } from "ai";
import { getRegistry } from "./registry.js";
import type { StreamChunk } from "./types.js";

type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
type JSONObject = { [key: string]: JSONValue | undefined };
type JSONArray = JSONValue[];

/** AI SDK ProviderOptions = Record<string, JSONObject> */
type ProviderOptions = Record<string, JSONObject>;

/**
 * Return providerOptions for extended thinking on supported Anthropic models.
 * Returns undefined for models that do not support reasoning.
 */
export function getReasoningOptions(model: string): ProviderOptions | undefined {
	const isThinkingModel =
		model.includes("claude-opus-4") ||
		model.includes("claude-sonnet-4") ||
		model.includes("claude-3-7-sonnet");
	if (!isThinkingModel) return undefined;
	return {
		anthropic: {
			thinking: { type: "enabled", budgetTokens: 8000 },
		},
	};
}

/**
 * Stream a chat response from any provider via the unified registry.
 * The model parameter must be provider-qualified (e.g. "anthropic:claude-sonnet-4-5-20250929").
 * Yields structured chunks (delta, reasoning, source, done) as they arrive.
 */
export async function* streamChatResponse(
	model: string,
	messages: ModelMessage[],
	system?: string,
): AsyncGenerator<StreamChunk> {
	const registry = getRegistry();
	// Registry is built dynamically so its type parameter is empty.
	// Cast model string to satisfy the typed overload.
	const languageModel = registry.languageModel(model as never);

	const providerOptions = getReasoningOptions(model);

	const result = streamText({
		model: languageModel,
		messages,
		system,
		...(providerOptions ? { providerOptions } : {}),
	});

	for await (const part of result.fullStream) {
		switch (part.type) {
			case "text-delta":
				yield { type: "delta", text: part.text };
				break;
			case "reasoning-delta":
				yield { type: "reasoning", text: part.text };
				break;
			case "source":
				if (part.sourceType === "url") {
					yield { type: "source", url: part.url, title: part.title };
				}
				break;
			case "finish":
				break;
		}
	}

	const usage = await result.usage;
	const inputTokens = usage.inputTokens ?? 0;
	const outputTokens = usage.outputTokens ?? 0;
	const totalTokens =
		usage.totalTokens ?? inputTokens + outputTokens;

	yield {
		type: "done",
		usage: { inputTokens, outputTokens, totalTokens },
	};
}
