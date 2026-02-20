export interface PendingRouting {
	requestId: string;
	sessionId: string;
	content: string;
	routedModel: string;
}

export interface PendingPreflight {
	requestId: string;
	sessionId: string;
	model: string;
	content: string;
	context: { messages: import("ai").ModelMessage[]; system: string };
	tools: Record<string, unknown>;
	routingInfo?: { tier: "high" | "standard" | "budget"; reason: string };
}

export interface ConnectionState {
	sessionId: string | null;
	streaming: boolean;
	streamRequestId: string | null;
	pendingRouting: PendingRouting | null;
	pendingApprovals: Map<string, { toolName: string; resolve: (approved: boolean) => void }>;
	tools: Record<string, unknown> | null;
	approvalPolicy: import("../agent/approval-gate.js").ApprovalPolicy | null;
	pendingPreflight: PendingPreflight | null;
	lastTerminalSnapshot: string | null;
	terminalControlGranted: boolean;
	pendingWorkflowApprovals: Map<string, { executionId: string; resolve: (approved: boolean) => void }>;
	claudeCodeSessions: Map<string, string>;
	lastAgentId?: string;
}

const connections = new Map<string, ConnectionState>();

/**
 * Initialize connection state for a transport.
 */
export function initConnection(transportId: string): ConnectionState {
	const state: ConnectionState = {
		sessionId: null,
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
	connections.set(transportId, state);
	return state;
}

/**
 * Get connection state for a transport.
 */
export function getConnectionState(
	transportId: string,
): ConnectionState | undefined {
	return connections.get(transportId);
}

/**
 * Mark a connection as actively streaming.
 */
export function markStreaming(transportId: string, requestId: string): void {
	const state = connections.get(transportId);
	if (state) {
		state.streaming = true;
		state.streamRequestId = requestId;
	}
}

/**
 * Clear the streaming flag on a connection.
 */
export function clearStreaming(transportId: string): void {
	const state = connections.get(transportId);
	if (state) {
		state.streaming = false;
		state.streamRequestId = null;
	}
}

/**
 * Check if a connection is currently streaming.
 */
export function isStreaming(transportId: string): boolean {
	const state = connections.get(transportId);
	return state?.streaming ?? false;
}

/**
 * Remove connection state (on close).
 */
export function removeConnection(transportId: string): void {
	connections.delete(transportId);
}
