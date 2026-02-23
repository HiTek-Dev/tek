import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useWebSocket } from './useWebSocket';
import type { ClientMessage, ServerMessage } from '@/lib/gateway-client';

type PendingRequest = {
  resolve: (msg: ServerMessage) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_TIMEOUT = 15_000;

/**
 * Generic RPC hook for gateway WebSocket communication.
 * Wraps send + await-response matching on message `id`.
 */
export function useGatewayRpc() {
  const port = useAppStore((s) => s.gateway.port);
  const wsUrl = port ? `ws://127.0.0.1:${port}/gateway` : '';
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());

  const handleMessage = useCallback((data: string) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(data) as ServerMessage;
    } catch {
      return;
    }

    // Match response to pending request by `id` field
    const id = 'id' in msg ? (msg as { id: string }).id : undefined;
    if (id && pendingRef.current.has(id)) {
      const pending = pendingRef.current.get(id)!;
      clearTimeout(pending.timer);
      pendingRef.current.delete(id);
      pending.resolve(msg);
    }
  }, []);

  const { status, send: rawSend } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    enabled: !!port,
  });

  // Cleanup pending requests on unmount
  useEffect(() => {
    return () => {
      for (const [, pending] of pendingRef.current) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Component unmounted'));
      }
      pendingRef.current.clear();
    };
  }, []);

  /**
   * Send a message and wait for the matching response.
   */
  const request = useCallback(
    <T extends ServerMessage>(msg: ClientMessage, timeout = DEFAULT_TIMEOUT): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        if (status !== 'connected') {
          reject(new Error('WebSocket not connected'));
          return;
        }

        const id = msg.id;
        const timer = setTimeout(() => {
          pendingRef.current.delete(id);
          reject(new Error(`Request timed out after ${timeout}ms`));
        }, timeout);

        pendingRef.current.set(id, {
          resolve: resolve as (msg: ServerMessage) => void,
          reject,
          timer,
        });

        rawSend(JSON.stringify(msg));
      });
    },
    [status, rawSend],
  );

  /**
   * Fire-and-forget send (no response expected).
   */
  const send = useCallback(
    (msg: ClientMessage) => {
      if (status === 'connected') {
        rawSend(JSON.stringify(msg));
      }
    },
    [status, rawSend],
  );

  return {
    request,
    send,
    connected: status === 'connected',
    status,
  };
}
