import { useState, useEffect, useCallback } from 'react';
import { IDENTITY_FILES, loadIdentityFile, saveIdentityFile } from '../lib/files';

export interface FileState {
  content: string | null;
  modified: boolean;
  loading: boolean;
}

export function useIdentityFiles(agentId?: string) {
  const [files, setFiles] = useState<Map<string, FileState>>(new Map());
  const [activeFile, setActiveFile] = useState<string>('SOUL.md');

  // Compute a stable key from agentId to trigger reload when agent changes
  const agentKey = agentId ?? 'default';

  // Load all identity files on mount or when agentId changes
  useEffect(() => {
    const initialMap = new Map<string, FileState>();
    for (const file of IDENTITY_FILES) {
      initialMap.set(file.filename, { content: null, modified: false, loading: true });
    }
    setFiles(initialMap);

    Promise.all(
      IDENTITY_FILES.map(async (file) => {
        const content = await loadIdentityFile(file.filename, agentId);
        return { filename: file.filename, content };
      })
    ).then((results) => {
      setFiles((prev) => {
        const next = new Map(prev);
        for (const { filename, content } of results) {
          next.set(filename, { content, modified: false, loading: false });
        }
        return next;
      });
    });
  }, [agentKey]);

  const setContent = useCallback((filename: string, content: string) => {
    setFiles((prev) => {
      const next = new Map(prev);
      const current = next.get(filename);
      if (current) {
        next.set(filename, { ...current, content, modified: true });
      }
      return next;
    });
  }, []);

  const save = useCallback(async (filename: string) => {
    const state = files.get(filename);
    if (!state || state.content === null) return;

    await saveIdentityFile(filename, state.content, agentId);
    setFiles((prev) => {
      const next = new Map(prev);
      const current = next.get(filename);
      if (current) {
        next.set(filename, { ...current, modified: false });
      }
      return next;
    });
  }, [files, agentId]);

  const saveAll = useCallback(async () => {
    const promises: Promise<void>[] = [];
    for (const [filename, state] of files) {
      if (state.modified && state.content !== null) {
        promises.push(
          saveIdentityFile(filename, state.content, agentId).then(() => {
            setFiles((prev) => {
              const next = new Map(prev);
              const current = next.get(filename);
              if (current) {
                next.set(filename, { ...current, modified: false });
              }
              return next;
            });
          })
        );
      }
    }
    await Promise.all(promises);
  }, [files, agentId]);

  const reload = useCallback(async (filename?: string) => {
    const filesToReload = filename
      ? IDENTITY_FILES.filter((f) => f.filename === filename)
      : IDENTITY_FILES;

    // Set loading state
    setFiles((prev) => {
      const next = new Map(prev);
      for (const file of filesToReload) {
        const current = next.get(file.filename);
        if (current) {
          next.set(file.filename, { ...current, loading: true });
        }
      }
      return next;
    });

    const results = await Promise.all(
      filesToReload.map(async (file) => {
        const content = await loadIdentityFile(file.filename, agentId);
        return { filename: file.filename, content };
      })
    );

    setFiles((prev) => {
      const next = new Map(prev);
      for (const { filename: fn, content } of results) {
        next.set(fn, { content, modified: false, loading: false });
      }
      return next;
    });
  }, [agentId]);

  return {
    files,
    activeFile,
    setActiveFile,
    setContent,
    save,
    saveAll,
    reload,
  };
}
