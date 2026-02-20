import { useEffect, useRef, useCallback, useState } from "react";
import TauriWebSocket from "@tauri-apps/plugin-websocket";
import type { Message } from "@tauri-apps/plugin-websocket";

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const JITTER_FACTOR = 0.3;

function getReconnectDelay(attempt: number): number {
	const exponential = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
	const jitter = exponential * JITTER_FACTOR * Math.random();
	return exponential + jitter;
}

export interface UseWebSocketReturn {
	connected: boolean;
	error: string | null;
	send: (msg: object) => void;
	addMessageHandler: (handler: (msg: unknown) => void) => void;
	removeMessageHandler: (handler: (msg: unknown) => void) => void;
	sessionId: string | null;
}

/**
 * React hook for managing a WebSocket connection to the Tek gateway
 * via the Tauri WebSocket plugin.
 *
 * Pass `null` as URL when gateway is not discovered -- no connection attempt.
 * Handles auto-reconnect on disconnect with exponential backoff
 * (1s->2s->4s->8s->max 30s) and unlimited retries.
 */
export function useWebSocket(url: string | null): UseWebSocketReturn {
	const [connected, setConnected] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const wsRef = useRef<TauriWebSocket | null>(null);
	const handlersRef = useRef<Set<(msg: unknown) => void>>(new Set());
	const retriesRef = useRef(0);
	const mountedRef = useRef(true);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const urlRef = useRef(url);
	const sessionIdRef = useRef<string | null>(null);
	urlRef.current = url;

	const cleanup = useCallback(() => {
		if (reconnectTimerRef.current) {
			clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
		if (wsRef.current) {
			wsRef.current.disconnect().catch(() => {});
			wsRef.current = null;
		}
		setConnected(false);
	}, []);

	const connect = useCallback(async () => {
		const currentUrl = urlRef.current;
		if (!currentUrl || !mountedRef.current) return;

		try {
			// Clean up any previous connection
			if (wsRef.current) {
				await wsRef.current.disconnect().catch(() => {});
				wsRef.current = null;
			}

			const ws = await TauriWebSocket.connect(currentUrl);
			if (!mountedRef.current) {
				await ws.disconnect().catch(() => {});
				return;
			}

			wsRef.current = ws;
			setConnected(true);
			setError(null);
			retriesRef.current = 0;

			ws.addListener((msg: Message) => {
				if (msg.type === "Text") {
					try {
						const parsed: unknown = JSON.parse(msg.data);
						// Track sessionId if present for session resumption
						if (
							parsed &&
							typeof parsed === "object" &&
							"sessionId" in parsed &&
							typeof (parsed as Record<string, unknown>).sessionId ===
								"string"
						) {
							sessionIdRef.current = (
								parsed as Record<string, unknown>
							).sessionId as string;
						}
						for (const handler of handlersRef.current) {
							handler(parsed);
						}
					} catch {
						// Ignore unparseable messages
					}
				} else if (msg.type === "Close") {
					setConnected(false);
					wsRef.current = null;

					// Attempt reconnect with exponential backoff (unlimited retries)
					if (mountedRef.current && urlRef.current) {
						const delay = getReconnectDelay(retriesRef.current);
						retriesRef.current++;
						reconnectTimerRef.current = setTimeout(() => {
							connect();
						}, delay);
					}
				}
			});
		} catch (err) {
			if (!mountedRef.current) return;

			const message =
				err instanceof Error ? err.message : "WebSocket connection failed";
			setError(message);
			setConnected(false);

			// Attempt reconnect with exponential backoff (unlimited retries)
			if (mountedRef.current && urlRef.current) {
				const delay = getReconnectDelay(retriesRef.current);
				retriesRef.current++;
				reconnectTimerRef.current = setTimeout(() => {
					connect();
				}, delay);
			}
		}
	}, []);

	// Connect/disconnect when URL changes
	useEffect(() => {
		mountedRef.current = true;
		retriesRef.current = 0;

		if (url) {
			connect();
		} else {
			cleanup();
		}

		return () => {
			mountedRef.current = false;
			cleanup();
		};
	}, [url, connect, cleanup]);

	const send = useCallback((msg: object) => {
		if (wsRef.current) {
			wsRef.current.send(JSON.stringify(msg)).catch(() => {
				setError("Failed to send message");
			});
		}
	}, []);

	const addMessageHandler = useCallback(
		(handler: (msg: unknown) => void) => {
			handlersRef.current.add(handler);
		},
		[],
	);

	const removeMessageHandler = useCallback(
		(handler: (msg: unknown) => void) => {
			handlersRef.current.delete(handler);
		},
		[],
	);

	return {
		connected,
		error,
		send,
		addMessageHandler,
		removeMessageHandler,
		sessionId: sessionIdRef.current,
	};
}
