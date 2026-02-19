import { useState, useEffect, useCallback } from 'react';
import { loadConfig, saveConfig, type AppConfig } from '../lib/config';

interface UseConfigReturn {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  modified: boolean;
  updateField: (key: string, value: unknown) => void;
  save: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useConfig(): UseConfigReturn {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modified, setModified] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setModified(false);
    try {
      const loaded = await loadConfig();
      setConfig(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const updateField = useCallback((key: string, value: unknown) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
    setModified(true);
  }, []);

  const save = useCallback(async () => {
    if (!config) return;
    try {
      await saveConfig(config);
      setModified(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save config');
    }
  }, [config]);

  return { config, loading, error, modified, updateField, save, reload };
}
