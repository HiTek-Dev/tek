import type { WebSocket } from "ws";

export interface PendingRouting {
	requestId: string;
	sessionId: string;
	content: string;
	routedModel: string;
}

export interface ConnectionState {
	sessionId: string | null;
	streaming: boolean;
	streamRequestId: string | null;
	pendingRouting: PendingRouting | null;
	pendingApprovals: Map<string, { resolve: (approved: boolean) => void }>;
	tools: Record<string, unknown> | null;
	approvalPolicy: import("../agent/approval-gate.js").ApprovalPolicy | null;
}

const connections = new WeakMap<WebSocket, ConnectionState>();

/**
 * Initialize connection state for a new WebSocket.
 */
export function initConnection(ws: WebSocket): ConnectionState {
	const state: ConnectionState = {
		sessionId: null,
		streaming: false,
		streamRequestId: null,
		pendingRouting: null,
		pendingApprovals: new Map(),
		tools: null,
		approvalPolicy: null,
	};
	connections.set(ws, state);
	return state;
}

/**
 * Get connection state for a WebSocket.
 */
export function getConnectionState(
	ws: WebSocket,
): ConnectionState | undefined {
	return connections.get(ws);
}

/**
 * Mark a connection as actively streaming.
 */
export function markStreaming(ws: WebSocket, requestId: string): void {
	const state = connections.get(ws);
	if (state) {
		state.streaming = true;
		state.streamRequestId = requestId;
	}
}

/**
 * Clear the streaming flag on a connection.
 */
export function clearStreaming(ws: WebSocket): void {
	const state = connections.get(ws);
	if (state) {
		state.streaming = false;
		state.streamRequestId = null;
	}
}

/**
 * Check if a connection is currently streaming.
 */
export function isStreaming(ws: WebSocket): boolean {
	const state = connections.get(ws);
	return state?.streaming ?? false;
}

/**
 * Remove connection state (on close).
 */
export function removeConnection(ws: WebSocket): void {
	connections.delete(ws);
}
