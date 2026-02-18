import type { CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import type { Transport } from "../transport.js";
import type { ConnectionState } from "../ws/connection.js";
import { createLogger } from "@tek/core";

const logger = createLogger("claude-code-approval");

/** Timeout for waiting on user approval (auto-deny after this). */
const APPROVAL_TIMEOUT_MS = 60_000;

/** Tools that are read-only and can be auto-approved. */
const READ_ONLY_TOOLS = new Set([
	"Read",
	"Grep",
	"Glob",
	"WebFetch",
	"LS",
	"View",
]);

/**
 * Create a `canUseTool` callback for the Claude Code Agent SDK that proxies
 * approval requests to the user's active transport.
 *
 * Read-only tools are auto-approved. All other tools send a
 * `tool.approval.request` via the transport and wait for a
 * `tool.approval.response` resolved through `connState.pendingApprovals`.
 */
export function createApprovalProxy(
	transport: Transport,
	requestId: string,
	connState: ConnectionState,
): CanUseTool {
	return async (
		toolName: string,
		input: Record<string, unknown>,
		options: { signal: AbortSignal; toolUseID: string },
	) => {
		// Auto-approve read-only tools
		if (READ_ONLY_TOOLS.has(toolName)) {
			return { behavior: "allow" as const, updatedInput: input };
		}

		const approvalId = crypto.randomUUID();

		logger.info("Requesting tool approval from user", {
			toolName,
			approvalId,
			requestId,
		});

		// Send approval request to the user's transport
		transport.send({
			type: "tool.approval.request",
			requestId,
			toolCallId: approvalId,
			toolName,
			args: input,
		});

		// Wait for response via the shared pendingApprovals Map
		const approved = await waitForApprovalWithAbort(
			approvalId,
			toolName,
			connState,
			APPROVAL_TIMEOUT_MS,
			options.signal,
		);

		if (approved) {
			return { behavior: "allow" as const, updatedInput: input };
		}

		return {
			behavior: "deny" as const,
			message: "User denied permission",
		};
	};
}

/**
 * Wait for a tool approval response, racing against both a timeout
 * and the SDK's abort signal.
 */
function waitForApprovalWithAbort(
	approvalId: string,
	toolName: string,
	connState: ConnectionState,
	timeoutMs: number,
	signal: AbortSignal,
): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		// If already aborted, deny immediately
		if (signal.aborted) {
			resolve(false);
			return;
		}

		const timer = setTimeout(() => {
			cleanup();
			logger.warn("Tool approval timed out, auto-denying", {
				approvalId,
				toolName,
			});
			resolve(false);
		}, timeoutMs);

		const onAbort = () => {
			cleanup();
			logger.info("Tool approval aborted by signal", {
				approvalId,
				toolName,
			});
			resolve(false);
		};

		signal.addEventListener("abort", onAbort, { once: true });

		const cleanup = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", onAbort);
			connState.pendingApprovals.delete(approvalId);
		};

		connState.pendingApprovals.set(approvalId, {
			toolName,
			resolve: (approved: boolean) => {
				cleanup();
				resolve(approved);
			},
		});
	});
}
