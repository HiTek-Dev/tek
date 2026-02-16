export type ProviderName = "anthropic" | "openai" | "ollama";

export type ModelTier = "high" | "standard" | "budget";

export interface StreamDelta {
	type: "delta";
	text: string;
}

export interface StreamDone {
	type: "done";
	usage: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
}

export type StreamChunk = StreamDelta | StreamDone;

// ── Routing Types ─────────────────────────────────────────────────────

export type RoutingMode = "auto" | "manual" | "off";

export interface RoutingDecision {
	tier: ModelTier;
	provider: string;
	model: string;
	reason: string;
	confidence: number; // 0-1
}

export interface RoutingRule {
	tier: ModelTier;
	match: (message: string, historyLength: number) => boolean;
	priority: number; // lower = higher priority
}

export interface TierConfig {
	high: string; // provider-qualified model ID
	standard: string;
	budget: string;
}
