import { useState, useCallback } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { useAppStore } from "@/stores/app-store";
import { discoverGateway } from "@/lib/discovery";

type GatewayAction = "starting" | "stopping" | "restarting" | null;

export function useGatewayControl() {
  const [actionInProgress, setActionInProgress] = useState<GatewayAction>(null);
  const [error, setError] = useState<string | null>(null);
  const setGateway = useAppStore((s) => s.setGateway);

  const pollUntilStatus = useCallback(
    async (target: "running" | "stopped", maxAttempts = 10) => {
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const info = await discoverGateway();
        if (target === "running" && info) {
          setGateway(info);
          return true;
        }
        if (target === "stopped" && !info) {
          setGateway(null);
          return true;
        }
      }
      return false;
    },
    [setGateway],
  );

  const startGateway = useCallback(async () => {
    setActionInProgress("starting");
    setError(null);
    try {
      const cmd = Command.create("tek", ["gateway", "start"]);
      await cmd.execute();
      await pollUntilStatus("running");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start gateway");
    } finally {
      setActionInProgress(null);
    }
  }, [pollUntilStatus]);

  const stopGateway = useCallback(async () => {
    setActionInProgress("stopping");
    setError(null);
    try {
      const cmd = Command.create("tek", ["gateway", "stop"]);
      await cmd.execute();
      await pollUntilStatus("stopped");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop gateway");
    } finally {
      setActionInProgress(null);
    }
  }, [pollUntilStatus]);

  const restartGateway = useCallback(async () => {
    setActionInProgress("restarting");
    setError(null);
    try {
      const stopCmd = Command.create("tek", ["gateway", "stop"]);
      await stopCmd.execute();
      await pollUntilStatus("stopped", 5);

      const startCmd = Command.create("tek", ["gateway", "start"]);
      await startCmd.execute();
      await pollUntilStatus("running");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restart gateway");
    } finally {
      setActionInProgress(null);
    }
  }, [pollUntilStatus]);

  return {
    startGateway,
    stopGateway,
    restartGateway,
    actionInProgress,
    error,
  };
}
