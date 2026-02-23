import { create } from "zustand";

export interface Process {
  id: string;
  name: string;
  type: "tool" | "sub-agent" | "workflow";
  status: "running" | "completed" | "error";
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  logs: LogEntry[];
  result?: unknown;
}

export interface LogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  module?: string;
}

interface ProcessState {
  processes: Map<string, Process>;
  panelOpen: boolean;
  logSubscribed: boolean;
  gatewayLogs: LogEntry[];

  addProcess: (id: string, name: string, type: Process["type"]) => void;
  addProcessLog: (processId: string, log: LogEntry) => void;
  endProcess: (processId: string, status: "completed" | "error", durationMs: number, result?: unknown) => void;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  setLogSubscribed: (subscribed: boolean) => void;
  addGatewayLog: (log: LogEntry) => void;
  clearCompleted: () => void;
}

export const useProcessStore = create<ProcessState>((set) => ({
  processes: new Map(),
  panelOpen: false,
  logSubscribed: false,
  gatewayLogs: [],

  addProcess: (id, name, type) =>
    set((state) => {
      const processes = new Map(state.processes);
      processes.set(id, {
        id,
        name,
        type,
        status: "running",
        startedAt: Date.now(),
        logs: [],
      });
      return { processes, panelOpen: true };
    }),

  addProcessLog: (processId, log) =>
    set((state) => {
      const processes = new Map(state.processes);
      const process = processes.get(processId);
      if (process) {
        processes.set(processId, {
          ...process,
          logs: [...process.logs, log],
        });
      }
      return { processes };
    }),

  endProcess: (processId, status, durationMs, result) =>
    set((state) => {
      const processes = new Map(state.processes);
      const process = processes.get(processId);
      if (process) {
        processes.set(processId, {
          ...process,
          status,
          endedAt: Date.now(),
          durationMs,
          result,
        });
      }
      return { processes };
    }),

  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
  setPanelOpen: (open) => set({ panelOpen: open }),
  setLogSubscribed: (subscribed) => set({ logSubscribed: subscribed }),

  addGatewayLog: (log) =>
    set((state) => ({
      gatewayLogs: [...state.gatewayLogs.slice(-499), log],
    })),

  clearCompleted: () =>
    set((state) => {
      const processes = new Map(state.processes);
      for (const [id, proc] of processes) {
        if (proc.status !== "running") {
          processes.delete(id);
        }
      }
      return { processes };
    }),
}));
