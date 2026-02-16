import { useEffect, useRef, useCallback, useState } from "react";
import WebSocket from "ws";
import type { ServerMessage, ClientMessage } from "@agentspace/gateway";

export interface UseWebSocketOptions {
	url: string;
	onMessage: (msg: ServerMessage) => void;
	onError?: (err: Error) => void;
	onClose?: () => void;
}

export interface UseWebSocketReturn {
	send: (msg: ClientMessage) => void;
	connected: boolean;
}

/**
 * React hook for managing a WebSocket connection to the AgentSpace gateway.
 * Handles connection lifecycle, message parsing, and reconnection state.
 */
export function useWebSocket(opts: UseWebSocketOptions): UseWebSocketReturn {
	const [connected, setConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);

	// Store callbacks in refs to avoid stale closures and re-triggering effects
	const onMessageRef = useRef(opts.onMessage);
	onMessageRef.current = opts.onMessage;

	const onErrorRef = useRef(opts.onError);
	onErrorRef.current = opts.onError;

	const onCloseRef = useRef(opts.onClose);
	onCloseRef.current = opts.onClose;

	useEffect(() => {
		const ws = new WebSocket(opts.url);
		wsRef.current = ws;

		ws.on("open", () => {
			setConnected(true);
		});

		ws.on("message", (raw: Buffer) => {
			try {
				const msg = JSON.parse(raw.toString()) as ServerMessage;
				onMessageRef.current(msg);
			} catch {
				// Ignore unparseable messages
			}
		});

		ws.on("error", (err: Error) => {
			onErrorRef.current?.(err);
		});

		ws.on("close", () => {
			setConnected(false);
			onCloseRef.current?.();
		});

		return () => {
			ws.close();
		};
	}, [opts.url]);

	const send = useCallback((msg: ClientMessage) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(msg));
		}
	}, []);

	return { send, connected };
}
