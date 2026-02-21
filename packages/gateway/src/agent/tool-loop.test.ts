import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";

vi.setConfig({ testTimeout: 10_000 });

// ── Mocks ─────────────────────────────────────────────────────────────

// Mock the registry module so runAgentLoop gets our MockLanguageModelV3
const mockModel = new MockLanguageModelV3();
vi.mock("../llm/registry.js", () => ({
	getRegistry: () => ({
		languageModel: () => mockModel,
	}),
}));

// Mock approval-gate (auto-approve everything)
vi.mock("./approval-gate.js", () => ({
	checkApproval: () => false,
	recordSessionApproval: vi.fn(),
}));

// Mock failure-detector (no failures)
vi.mock("./failure-detector.js", () => ({
	classifyFailurePattern: () => null,
}));

// Mock @tek/core logger
vi.mock("@tek/core", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

import { runAgentLoop, type AgentLoopOptions } from "./tool-loop.js";
import type { Transport } from "../transport.js";
import type { ConnectionState } from "../ws/connection.js";

// ── Helpers ───────────────────────────────────────────────────────────

function createMockTransport(): Transport & { messages: unknown[] } {
	const messages: unknown[] = [];
	return {
		transportId: "test:1",
		channel: "ws" as const,
		send: vi.fn((msg: unknown) => messages.push(msg)),
		messages,
	};
}

function createMockConnState(): ConnectionState {
	return {
		sessionId: "test-session",
		streaming: false,
		streamRequestId: null,
		pendingRouting: null,
		pendingApprovals: new Map(),
		tools: null,
		approvalPolicy: null,
		pendingPreflight: null,
		lastTerminalSnapshot: null,
		terminalControlGranted: false,
		pendingWorkflowApprovals: new Map(),
		claudeCodeSessions: new Map(),
	};
}

function baseOptions(transport: Transport): AgentLoopOptions {
	return {
		transport,
		model: "anthropic:claude-sonnet-4",
		messages: [{ role: "user" as const, content: "Hello" }],
		system: "You are a test assistant.",
		tools: {},
		requestId: "req-1",
		sessionId: "sess-1",
		connState: createMockConnState(),
		approvalPolicy: { defaultTier: "auto" as const, perTool: {}, sessionApprovals: new Set() },
		maxSteps: 3,
	};
}

/** Create a doStream mock returning text chunks via MockLanguageModelV3. */
function mockStreamWith(textChunks: string[]) {
	// AI SDK v6 model-layer text-delta uses `delta` (not `textDelta`)
	const chunks: unknown[] = [{ type: "text-start" }];
	for (const text of textChunks) {
		chunks.push({ type: "text-delta", delta: text });
	}
	chunks.push({ type: "text-end" });
	chunks.push({
		type: "finish",
		finishReason: { type: "stop" },
		usage: { inputTokens: 10, outputTokens: textChunks.length },
	});

	mockModel.doStream = vi.fn().mockResolvedValue({
		stream: simulateReadableStream({ chunks }),
		rawCall: { rawPrompt: null, rawSettings: {} },
	});
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("runAgentLoop", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sends text deltas to the transport", async () => {
		mockStreamWith(["Hello ", "world"]);

		const transport = createMockTransport();
		const result = await runAgentLoop(baseOptions(transport));

		expect(result).toContain("Hello ");
		expect(result).toContain("world");

		const deltas = transport.messages.filter(
			(m: any) => m.type === "chat.stream.delta",
		);
		expect(deltas.length).toBeGreaterThanOrEqual(1);

		const allDeltaText = deltas.map((d: any) => d.delta).join("");
		expect(allDeltaText).toContain("Hello ");
		expect(allDeltaText).toContain("world");
	});

	it("returns accumulated text from all deltas", async () => {
		mockStreamWith(["foo", "bar", "baz"]);

		const transport = createMockTransport();
		const result = await runAgentLoop(baseOptions(transport));

		expect(result).toBe("foobarbaz");
	});

	it("completes without error on an empty stream (no text deltas)", async () => {
		// Only finish chunk, no text deltas
		mockModel.doStream = vi.fn().mockResolvedValue({
			stream: simulateReadableStream({
				chunks: [
					{
						type: "finish",
						finishReason: { type: "stop" },
						usage: { inputTokens: 5, outputTokens: 0 },
					},
				],
			}),
			rawCall: { rawPrompt: null, rawSettings: {} },
		});

		const transport = createMockTransport();
		const result = await runAgentLoop(baseOptions(transport));

		// runAgentLoop sends a fallback message when no text was produced
		expect(result.length).toBeGreaterThan(0);
		expect(result).toContain("encountered errors");

		const deltas = transport.messages.filter(
			(m: any) => m.type === "chat.stream.delta",
		);
		expect(deltas.length).toBeGreaterThanOrEqual(1);
	});

	it("sends an error ServerMessage when the model stream emits an error", async () => {
		// In AI SDK v6, doStream rejection surfaces as an "error" part in fullStream
		// (not a thrown exception). The loop's "case error" branch handles it.
		mockModel.doStream = vi.fn().mockRejectedValue(new Error("Model unavailable"));

		const transport = createMockTransport();
		const result = await runAgentLoop(baseOptions(transport));

		const errors = transport.messages.filter(
			(m: any) => m.type === "error",
		);
		expect(errors.length).toBeGreaterThanOrEqual(1);

		// The error message should reference the model failure
		const errorMsg = errors.find(
			(e: any) => e.message?.includes("Model unavailable") || e.code === "AGENT_STREAM_ERROR" || e.code === "AGENT_LOOP_ERROR",
		);
		expect(errorMsg).toBeDefined();
	});

	// NOTE: Tool-call streaming paths are heavily coupled to AI SDK internals
	// (tool-approval-request, tool-call, tool-result events). Testing those
	// requires deeper integration mocking. These should be added after source
	// refactoring to decouple tool execution from the streaming loop.
});
