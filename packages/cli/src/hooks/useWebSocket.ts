import { useEffect, useRef, useCallback, useState } from "react";
import WebSocket from "ws";
import type { ServerMessage, ClientMessage } from "@tek/gateway";

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const JITTER_FACTOR = 0.3;

function getReconnectDelay(attempt: number): number {
	const exponential = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
	const jitter = exponential * JITTER_FACTOR * Math.random();
	return exponential + jitter;
}

export interface UseWebSocketOptions {
	url: string;
	onMessage: (msg: ServerMessage) => void;
	onError?: (err: Error) => void;
	onClose?: () => void;
}

export interface UseWebSocketReturn {
	send: (msg: ClientMessage) => void;
	connected: boolean;
	sessionId: string | null;
}

/**
 * React hook for managing a WebSocket connection to the Tek gateway.
 * Handles connection lifecycle, message parsing, and automatic reconnection
 * with exponential backoff (1s->2s->4s->8s->max 30s) and jitter.
 */
export function useWebSocket(opts: UseWebSocketOptions): UseWebSocketReturn {
	const [connected, setConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const attemptRef = useRef(0);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const sessionIdRef = useRef<string | null>(null);
	const mountedRef = useRef(true);

	// Store callbacks in refs to avoid stale closures and re-triggering effects
	const onMessageRef = useRef(opts.onMessage);
	onMessageRef.current = opts.onMessage;

	const onErrorRef = useRef(opts.onError);
	onErrorRef.current = opts.onError;

	const onCloseRef = useRef(opts.onClose);
	onCloseRef.current = opts.onClose;

	const urlRef = useRef(opts.url);
	urlRef.current = opts.url;

	const connect = useCallback(() => {
		if (!mountedRef.current) return;

		const ws = new WebSocket(urlRef.current);
		wsRef.current = ws;

		ws.on("open", () => {
			setConnected(true);
			attemptRef.current = 0;
		});

		ws.on("message", (raw: Buffer) => {
			try {
				const msg = JSON.parse(raw.toString()) as ServerMessage;
				// Track sessionId if present for session resumption
				if (
					msg &&
					typeof msg === "object" &&
					"sessionId" in msg &&
					typeof (msg as Record<string, unknown>).sessionId === "string"
				) {
					sessionIdRef.current = (msg as Record<string, unknown>)
						.sessionId as string;
				}
				onMessageRef.current(msg);
			} catch {
				// Ignore unparseable messages
			}
		});

		ws.on("error", (err: Error) => {
			onErrorRef.current?.(err);
			ws.close();
		});

		ws.on("close", () => {
			setConnected(false);
			wsRef.current = null;
			onCloseRef.current?.();

			// Schedule reconnect with exponential backoff
			if (mountedRef.current) {
				const delay = getReconnectDelay(attemptRef.current);
				attemptRef.current++;
				reconnectTimerRef.current = setTimeout(connect, delay);
			}
		});
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		connect();

		return () => {
			mountedRef.current = false;
			if (reconnectTimerRef.current) {
				clearTimeout(reconnectTimerRef.current);
			}
			wsRef.current?.close();
		};
	}, [opts.url, connect]);

	const send = useCallback((msg: ClientMessage) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(msg));
		}
	}, []);

	return { send, connected, sessionId: sessionIdRef.current };
}
