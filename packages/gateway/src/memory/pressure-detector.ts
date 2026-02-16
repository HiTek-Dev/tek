/**
 * Monitors context window utilization and triggers memory flush
 * when usage exceeds the configured threshold (default 70%).
 */
export class MemoryPressureDetector {
	private maxContextTokens: number;
	private triggerThreshold: number;

	constructor(config?: { maxContextTokens?: number; triggerThreshold?: number }) {
		this.maxContextTokens = config?.maxContextTokens ?? 200_000;
		this.triggerThreshold = config?.triggerThreshold ?? 0.70;
	}

	/**
	 * Check current context utilization against the threshold.
	 * Returns whether a flush should be triggered, usage ratio, and remaining tokens.
	 */
	check(tokenCounts: {
		system: number;
		memory: number;
		conversation: number;
	}): {
		shouldFlush: boolean;
		usage: number;
		remaining: number;
	} {
		const total = tokenCounts.system + tokenCounts.memory + tokenCounts.conversation;
		const usage = total / this.maxContextTokens;
		const remaining = this.maxContextTokens - total;

		return {
			shouldFlush: usage >= this.triggerThreshold,
			usage,
			remaining,
		};
	}
}
