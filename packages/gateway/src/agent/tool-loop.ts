import type { Transport } from "../transport.js";
import type { ModelMessage, LanguageModelUsage } from "ai";
import { streamText, stepCountIs } from "ai";
import { createLogger } from "@tek/core";
import { getRegistry } from "../llm/registry.js";
import { checkApproval, recordSessionApproval, type ApprovalPolicy } from "./approval-gate.js";
import { classifyFailurePattern, type StepRecord } from "./failure-detector.js";
import type { ConnectionState } from "../ws/connection.js";

const logger = createLogger("agent-tool-loop");

/** Default timeout for awaiting tool approval from the client (ms). */
const APPROVAL_TIMEOUT_MS = 60_000;

/** Default maximum number of agent steps before stopping. */
const DEFAULT_MAX_STEPS = 10;

export interface AgentLoopOptions {
	transport: Transport;
	model: string;
	messages: ModelMessage[];
	system: string;
	tools: Record<string, unknown>;
	requestId: string;
	sessionId: string;
	connState: ConnectionState;
	approvalPolicy: ApprovalPolicy;
	maxSteps?: number;
	onUsage?: (usage: LanguageModelUsage) => void;
}

/**
 * Run the agent tool loop: streams text, executes tool calls,
 * relays results over the transport, and pauses for approval when needed.
 *
 * Uses AI SDK's `streamText` with `fullStream` to capture tool-call,
 * tool-result, and tool-approval-request events alongside text deltas.
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<void> {
	const {
		transport,
		model,
		messages,
		system,
		tools,
		requestId,
		sessionId,
		connState,
		approvalPolicy,
		maxSteps = DEFAULT_MAX_STEPS,
		onUsage,
	} = options;

	const registry = getRegistry();
	const languageModel = registry.languageModel(model as never);

	const stepHistory: StepRecord[] = [];

	try {
		const result = streamText({
			model: languageModel,
			messages,
			system,
			tools: tools as any,
			stopWhen: stepCountIs(maxSteps),
			onStepFinish: async (stepResult) => {
				const record: StepRecord = {
					stepType: stepHistory.length === 0 ? "initial" : "continue",
					finishReason: stepResult.finishReason,
					toolCalls: stepResult.toolCalls?.map((tc: any) => ({
						toolName: String(tc.toolName),
						input: tc.input,
					})),
					toolResults: stepResult.toolResults?.map((tr: any) => ({
						toolName: String(tr.toolName),
						output: tr.output,
					})),
					text: stepResult.text,
				};
				stepHistory.push(record);
				const failure = classifyFailurePattern(stepHistory, maxSteps);
				if (failure) {
					transport.send({
						type: "failure.detected",
						requestId,
						pattern: failure.pattern,
						description: failure.description,
						suggestedAction: failure.suggestedAction,
						...(failure.affectedTool ? { affectedTool: failure.affectedTool } : {}),
					});
				}
			},
		});

		for await (const part of result.fullStream) {
			switch (part.type) {
				case "text-delta": {
					transport.send({
						type: "chat.stream.delta",
						requestId,
						delta: part.text,
					});
					break;
				}

				case "tool-call": {
					const toolCallId = part.toolCallId;
					const toolName = String(part.toolName);
					const args = part.input;

					transport.send({
						type: "tool.call",
						requestId,
						toolCallId,
						toolName,
						args,
					});
					break;
				}

				case "tool-result": {
					const toolCallId = part.toolCallId;
					const toolName = String(part.toolName);

					transport.send({
						type: "tool.result",
						requestId,
						toolCallId,
						toolName,
						result: part.output,
					});
					break;
				}

				case "tool-error": {
					const toolCallId = part.toolCallId;
					const toolName = String(part.toolName);
					const errorMessage =
						part.error instanceof Error
							? part.error.message
							: String(part.error);

					logger.warn(
						`Tool execution error [${toolName}]: ${errorMessage}`,
					);

					transport.send({
						type: "tool.error",
						requestId,
						toolCallId,
						toolName,
						error: errorMessage,
					});
					break;
				}

				case "tool-approval-request": {
					const toolCall = part.toolCall;
					const toolCallId = toolCall.toolCallId;
					const toolName = String(toolCall.toolName);

					// Check if approval is needed based on policy
					const needsApproval = checkApproval(toolName, approvalPolicy);

					if (needsApproval) {
						transport.send({
							type: "tool.approval.request",
							requestId,
							toolCallId,
							toolName,
							args: toolCall.input,
						});

						// Wait for client approval response
						const approved = await waitForApproval(
							toolCallId,
							toolName,
							connState,
							APPROVAL_TIMEOUT_MS,
						);

						if (!approved) {
							logger.info(
								`Tool approval denied for ${toolName} (${toolCallId})`,
							);
						}
					}
					break;
				}

				case "finish-step": {
					logger.info(
						`Agent step finished (reason: ${part.finishReason}, tokens: ${part.usage.totalTokens ?? 0})`,
					);
					break;
				}

				case "finish": {
					if (onUsage) {
						onUsage(part.totalUsage);
					}
					break;
				}

				case "error": {
					logger.error(`Stream error: ${part.error}`);
					transport.send({
						type: "error",
						requestId,
						code: "AGENT_STREAM_ERROR",
						message:
							part.error instanceof Error
								? part.error.message
								: String(part.error),
					});
					break;
				}

				default:
					// Log unexpected part types for debugging
					logger.info(`Unhandled stream part type: ${(part as any).type}`);
					break;
			}
		}
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Unknown agent loop error";
		logger.error(`Agent loop error: ${message}`);
		transport.send({
			type: "error",
			requestId,
			code: "AGENT_LOOP_ERROR",
			message,
		});
	}
}

/**
 * Wait for a tool approval response from the client.
 * Returns true if approved, false if denied or timed out.
 */
function waitForApproval(
	toolCallId: string,
	toolName: string,
	connState: ConnectionState,
	timeoutMs: number,
): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		const timer = setTimeout(() => {
			// Auto-deny on timeout
			connState.pendingApprovals.delete(toolCallId);
			logger.warn(`Tool approval timed out for ${toolCallId}, auto-denying`);
			resolve(false);
		}, timeoutMs);

		connState.pendingApprovals.set(toolCallId, {
			toolName,
			resolve: (approved: boolean) => {
				clearTimeout(timer);
				connState.pendingApprovals.delete(toolCallId);
				resolve(approved);
			},
		});
	});
}
