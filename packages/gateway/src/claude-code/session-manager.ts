import { query, type Query, type PermissionMode, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { createLogger } from "@agentspace/core";
import type { Transport } from "../transport.js";
import type { ClaudeCodeSession, SpawnSessionOptions } from "./types.js";
import { consumeAndRelay } from "./event-relay.js";

const logger = createLogger("claude-code");

/**
 * Post-completion timeout in milliseconds.
 * After receiving a "result" event, abort the session if the generator
 * hasn't returned within this window (addresses CLI hanging bug).
 */
const POST_COMPLETION_TIMEOUT_MS = 30_000;

/**
 * Manages Claude Code sessions spawned via the Agent SDK.
 * Tracks session lifecycle, supports abort, and cleans up hanging sessions.
 */
export class ClaudeCodeSessionManager {
	private sessions = new Map<string, ClaudeCodeSession>();
	private postCompletionTimers = new Map<string, ReturnType<typeof setTimeout>>();

	/**
	 * Spawn a new Claude Code session.
	 * Starts consuming the async generator in the background and relaying
	 * events to the provided transport.
	 */
	spawn(
		options: SpawnSessionOptions,
		transport: Transport,
		requestId: string,
	): ClaudeCodeSession {
		const abortController = new AbortController();
		const sessionId = crypto.randomUUID();

		const session: ClaudeCodeSession = {
			id: sessionId,
			status: "spawning",
			abortController,
			prompt: options.prompt,
			cwd: options.cwd,
			createdAt: new Date(),
		};

		this.sessions.set(sessionId, session);

		logger.info("Spawning Claude Code session", {
			sessionId,
			cwd: options.cwd,
			permissionMode: options.permissionMode ?? "default",
		});

		// Spawn the SDK query
		const queryInstance: Query = query({
			prompt: options.prompt,
			options: {
				cwd: options.cwd,
				abortController,
				includePartialMessages: true,
				permissionMode: options.permissionMode ?? "default",
				allowedTools: options.allowedTools,
				maxTurns: options.maxTurns,
				canUseTool: options.canUseTool,
			},
		});

		session.status = "running";

		// Kick off event relay consumption (non-blocking)
		consumeAndRelay(session, queryInstance, transport, requestId, {
			onResult: () => this.schedulePostCompletionTimeout(sessionId, queryInstance),
			onDone: () => this.clearPostCompletionTimeout(sessionId),
		}).catch((err) => {
			logger.error("Event relay failed", {
				sessionId,
				error: String(err),
			});
		});

		return session;
	}

	/**
	 * Abort a running session by ID.
	 */
	abort(sessionId: string): boolean {
		const session = this.sessions.get(sessionId);
		if (!session) {
			logger.warn("Abort requested for unknown session", { sessionId });
			return false;
		}

		logger.info("Aborting Claude Code session", { sessionId });
		session.abortController.abort();
		session.status = "aborted";
		session.completedAt = new Date();
		this.clearPostCompletionTimeout(sessionId);
		return true;
	}

	/**
	 * Get a session by ID.
	 */
	getSession(sessionId: string): ClaudeCodeSession | undefined {
		return this.sessions.get(sessionId);
	}

	/**
	 * List all tracked sessions.
	 */
	listSessions(): ClaudeCodeSession[] {
		return Array.from(this.sessions.values());
	}

	/**
	 * Remove a session from tracking.
	 */
	cleanup(sessionId: string): void {
		this.clearPostCompletionTimeout(sessionId);
		this.sessions.delete(sessionId);
		logger.info("Cleaned up session", { sessionId });
	}

	/**
	 * Run a Claude Code session to completion without relaying to a transport.
	 * Designed for workflow integration where sessions run headlessly with
	 * pre-approved permissions (acceptEdits mode).
	 *
	 * Collects text output from the async generator and returns the final result.
	 */
	async runToCompletion(
		prompt: string,
		options: {
			cwd?: string;
			maxTurns?: number;
			permissionMode?: PermissionMode;
		} = {},
	): Promise<{ text: string; costUsd: number }> {
		const abortController = new AbortController();
		const sessionId = crypto.randomUUID();
		const cwd = options.cwd ?? process.cwd();

		logger.info("Running Claude Code to completion", {
			sessionId,
			cwd,
			maxTurns: options.maxTurns,
			permissionMode: options.permissionMode ?? "acceptEdits",
		});

		const queryInstance: Query = query({
			prompt,
			options: {
				cwd,
				abortController,
				permissionMode: options.permissionMode ?? "acceptEdits",
				maxTurns: options.maxTurns,
			},
		});

		let resultText = "";
		let costUsd = 0;

		// Set up post-completion timeout
		let postCompletionTimer: ReturnType<typeof setTimeout> | null = null;

		try {
			for await (const message of queryInstance) {
				if (message.type === "result") {
					const resultMsg = message as SDKMessage & { type: "result" };
					costUsd = (resultMsg as any).total_cost_usd ?? 0;
					if ((resultMsg as any).subtype === "success") {
						resultText = (resultMsg as any).result ?? "";
					} else {
						// Error result
						const errors = (resultMsg as any).errors ?? [];
						throw new Error(
							`Claude Code session failed: ${errors.join(", ") || (resultMsg as any).subtype}`,
						);
					}

					// Schedule post-completion timeout for CLI hanging bug
					postCompletionTimer = setTimeout(() => {
						logger.warn("Post-completion timeout in runToCompletion, closing query", { sessionId });
						queryInstance.close();
					}, POST_COMPLETION_TIMEOUT_MS);
				}
			}
		} finally {
			if (postCompletionTimer) {
				clearTimeout(postCompletionTimer);
			}
		}

		logger.info("Claude Code session completed", {
			sessionId,
			costUsd,
			resultLength: resultText.length,
		});

		return { text: resultText, costUsd };
	}

	/**
	 * Schedule a timeout to abort the session if the generator hasn't
	 * returned after receiving a result event (CLI hanging bug workaround).
	 */
	private schedulePostCompletionTimeout(sessionId: string, queryInstance: Query): void {
		this.clearPostCompletionTimeout(sessionId);

		const timer = setTimeout(() => {
			const session = this.sessions.get(sessionId);
			if (session && session.status === "completed") {
				logger.warn("Post-completion timeout reached, closing query", { sessionId });
				queryInstance.close();
			}
			this.postCompletionTimers.delete(sessionId);
		}, POST_COMPLETION_TIMEOUT_MS);

		this.postCompletionTimers.set(sessionId, timer);
	}

	/**
	 * Clear any pending post-completion timeout for a session.
	 */
	private clearPostCompletionTimeout(sessionId: string): void {
		const timer = this.postCompletionTimers.get(sessionId);
		if (timer) {
			clearTimeout(timer);
			this.postCompletionTimers.delete(sessionId);
		}
	}
}
