export { getAnthropicProvider } from "./provider.js";
export {
	getRegistry,
	resolveModelId,
	getAvailableProviders,
} from "./registry.js";
export { streamChatResponse } from "./stream.js";
export {
	classifyComplexity,
	routeMessage,
	getAlternatives,
} from "./router.js";
export { DEFAULT_RULES, DEFAULT_TIERS } from "./router-rules.js";
export type {
	StreamChunk,
	StreamDelta,
	StreamDone,
	ProviderName,
	ModelTier,
	RoutingMode,
	RoutingDecision,
	RoutingRule,
	TierConfig,
} from "./types.js";
