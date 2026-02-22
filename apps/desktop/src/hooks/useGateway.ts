import { useEffect, useRef, useState } from "react";
import { discoverGateway } from "@/lib/discovery";
import { useAppStore } from "@/stores/app-store";

const POLL_INTERVAL_MS = 5000;

/**
 * Hook that polls for gateway availability on mount and every 5 seconds.
 * Updates the global app store with gateway state.
 */
export function useGateway() {
  const setGateway = useAppStore((s) => s.setGateway);
  const gateway = useAppStore((s) => s.gateway);
  const [isPolling, setIsPolling] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const info = await discoverGateway();
      if (!cancelled) {
        setGateway(info);
      }
    }

    // Immediate check on mount
    check();

    // Poll every 5 seconds
    intervalRef.current = setInterval(check, POLL_INTERVAL_MS);
    setIsPolling(true);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
    };
  }, [setGateway]);

  return {
    status: gateway.status,
    port: gateway.port,
    isPolling,
  };
}
