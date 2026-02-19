import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/app-store';
import { discoverGateway } from '../lib/discovery';
import { startGateway as startGatewayProcess, stopGateway as stopGatewayProcess } from '../lib/process';

const POLL_INTERVAL_MS = 5000;

export function useGateway() {
  const gateway = useAppStore((s) => s.gateway);
  const setGateway = useAppStore((s) => s.setGateway);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const info = await discoverGateway();
    setGateway(info);
  }, [setGateway]);

  const start = useCallback(async () => {
    const result = await startGatewayProcess();
    if (result.success) {
      // Give the gateway a moment to write runtime.json
      await new Promise((r) => setTimeout(r, 1500));
      await refresh();
    }
    return result;
  }, [refresh]);

  const stop = useCallback(async () => {
    const result = await stopGatewayProcess();
    if (result.success) {
      await new Promise((r) => setTimeout(r, 500));
      await refresh();
    }
    return result;
  }, [refresh]);

  useEffect(() => {
    // Initial discovery on mount
    refresh();

    // Poll every 5 seconds
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refresh]);

  return {
    status: gateway.status,
    port: gateway.port,
    pid: gateway.pid,
    startedAt: gateway.startedAt,
    start,
    stop,
    refresh,
  };
}
