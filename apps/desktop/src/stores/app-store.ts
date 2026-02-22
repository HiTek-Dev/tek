import { create } from "zustand";

type View = "landing" | "chat";

interface GatewayState {
  status: "unknown" | "running" | "stopped";
  port: number | null;
  pid: number | null;
  startedAt: string | null;
}

interface AppState {
  currentView: View;
  setCurrentView: (view: View) => void;

  gateway: GatewayState;
  setGateway: (
    info: { pid: number; port: number; startedAt: string } | null,
  ) => void;

  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;

  sessionId: string | null;
  setSessionId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "landing",
  setCurrentView: (view) => set({ currentView: view }),

  gateway: { status: "unknown", port: null, pid: null, startedAt: null },
  setGateway: (info) =>
    set({
      gateway: info
        ? {
            status: "running",
            port: info.port,
            pid: info.pid,
            startedAt: info.startedAt,
          }
        : { status: "stopped", port: null, pid: null, startedAt: null },
    }),

  selectedAgentId: null,
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),

  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),
}));
