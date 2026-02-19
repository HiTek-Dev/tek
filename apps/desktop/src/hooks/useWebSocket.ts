import { useEffect, useRef, useCallback, useState } from "react";
import TauriWebSocket from "@tauri-apps/plugin-websocket";
import type { Message } from "@tauri-apps/plugin-websocket";

const MAX_RETRIES = 5;
const RECONNECT_DELAY_MS = 3000;

export interface UseWebSocketReturn {
	connected: boolean;
	error: string | null;
	send: (msg: object) => void;
	addMessageHandler: (handler: (msg: unknown) => void) => void;
	removeMessageHandler: (handler: (msg: unknown) => void) => void;
}

/**
 * React hook for managing a WebSocket connection to the Tek gateway
 * via the Tauri WebSocket plugin.
 *
 * Pass `null` as URL when gateway is not discovered -- no connection attempt.
 * Handles auto-reconnect on disconnect (max 5 retries, 3s delay).
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
						for (const handler of handlersRef.current) {
							handler(parsed);
						}
					} catch {
						// Ignore unparseable messages
					}
				} else if (msg.type === "Close") {
					setConnected(false);
					wsRef.current = null;

					// Attempt reconnect if still mounted and retries remain
					if (
						mountedRef.current &&
						retriesRef.current < MAX_RETRIES &&
						urlRef.current
					) {
						retriesRef.current++;
						reconnectTimerRef.current = setTimeout(() => {
							connect();
						}, RECONNECT_DELAY_MS);
					}
				}
			});
		} catch (err) {
			if (!mountedRef.current) return;

			const message =
				err instanceof Error ? err.message : "WebSocket connection failed";
			setError(message);
			setConnected(false);

			// Attempt reconnect
			if (retriesRef.current < MAX_RETRIES && urlRef.current) {
				retriesRef.current++;
				reconnectTimerRef.current = setTimeout(() => {
					connect();
				}, RECONNECT_DELAY_MS);
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

	return { connected, error, send, addMessageHandler, removeMessageHandler };
}
