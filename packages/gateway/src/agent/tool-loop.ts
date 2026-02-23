import type { Transport } from "../transport.js";
import type { ModelMessage, LanguageModelUsage } from "ai";
import { streamText, stepCountIs } from "ai";
import { createLogger } from "@tek/core";
import { getRegistry } from "../llm/registry.js";
import { getReasoningOptions } from "../llm/stream.js";
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
 *
 * Returns the accumulated text from all text-delta events (or a fallback
 * message when the agent produced no text output).
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<string> {
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
	const toolStartTimes = new Map<string, number>();

	let fullText = "";

	const providerOptions = getReasoningOptions(model);

	try {
		const result = streamText({
			model: languageModel,
			messages,
			system,
			tools: tools as any,
			stopWhen: stepCountIs(maxSteps),
			...(providerOptions ? { providerOptions } : {}),
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
					fullText += part.text;
					break;
				}

				case "reasoning-delta": {
					transport.send({
						type: "chat.stream.reasoning",
						requestId,
						delta: part.text,
					});
					break;
				}

				case "source": {
					if (part.sourceType === "url") {
						transport.send({
							type: "chat.stream.source",
							requestId,
							source: { url: part.url, title: part.title },
						});
					}
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

					// Emit subprocess.start for process monitoring
					transport.send({
						type: "subprocess.start",
						requestId,
						processId: toolCallId,
						name: toolName,
						processType: "tool",
					});

					// Track start time for duration calculation
					toolStartTimes.set(toolCallId, Date.now());
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

					// Emit subprocess.end for process monitoring
					const startTime = toolStartTimes.get(toolCallId);
					const durationMs = startTime ? Date.now() - startTime : 0;
					toolStartTimes.delete(toolCallId);
					transport.send({
						type: "subprocess.end",
						requestId,
						processId: toolCallId,
						status: "completed",
						durationMs,
						result: part.output,
					});

					// CRITICAL: Tool results are for LLM context only.
					// They are NOT added to session history.
					// Only the final assistant text (fullText) is persisted after loop completion.
					// This prevents second-turn agent loops from seeing tool artifacts as messages.

					break;
				}

				case "tool-error": {
					// Tool error is final — client should see this as tool failure and agent will attempt recovery.
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

					// Emit subprocess.end with error status
					const errStartTime = toolStartTimes.get(toolCallId);
					const errDurationMs = errStartTime ? Date.now() - errStartTime : 0;
					toolStartTimes.delete(toolCallId);
					transport.send({
						type: "subprocess.end",
						requestId,
						processId: toolCallId,
						status: "error",
						durationMs: errDurationMs,
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

		// Guarantee a response when agent produced no text (e.g. all tools failed)
		if (!fullText || fullText.trim().length === 0) {
			const fallback = "I attempted to use tools to help with your request, but encountered errors. Could you try rephrasing or providing more details?";
			transport.send({
				type: "chat.stream.delta",
				requestId,
				delta: fallback,
			});
			fullText = fallback;
		}

		return fullText;
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Unknown agent loop error";
		logger.error(`Agent loop error: ${message}`);
		transport.send({
			type: "error",
			requestId,
			code: "AGENT_LOOP_ERROR",
			message,
		});
		return "";
	} finally {
		// Ensure streaming flag is always cleared, even on error
		if (connState.streaming) {
			connState.streaming = false;
			connState.streamRequestId = null;
		}
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
