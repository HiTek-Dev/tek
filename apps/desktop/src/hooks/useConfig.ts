import { useEffect, useState } from "react";
import { loadConfig, type TekConfig } from "@/lib/config";

/**
 * Hook that loads the Tek configuration on mount.
 * Config is read-once (not stored in Zustand), so it uses local state.
 */
export function useConfig() {
  const [config, setConfig] = useState<TekConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await loadConfig();
        if (!cancelled) {
          setConfig(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err : new Error("Failed to load config"),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading, error };
}
