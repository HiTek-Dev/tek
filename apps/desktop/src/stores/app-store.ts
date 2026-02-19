import { create } from 'zustand';
import type { RuntimeInfo } from '../lib/discovery';
import type { Page } from '../App';

export interface GatewayState {
  status: 'unknown' | 'running' | 'stopped';
  port: number | null;
  pid: number | null;
  startedAt: string | null;
}

interface AppState {
  gateway: GatewayState;
  setGateway: (info: RuntimeInfo | null) => void;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

export const useAppStore = create<AppState>((set) => ({
  gateway: {
    status: 'unknown',
    port: null,
    pid: null,
    startedAt: null,
  },

  setGateway: (info: RuntimeInfo | null) =>
    set({
      gateway: info
        ? {
            status: 'running',
            port: info.port,
            pid: info.pid,
            startedAt: info.startedAt,
          }
        : {
            status: 'stopped',
            port: null,
            pid: null,
            startedAt: null,
          },
    }),

  currentPage: 'dashboard',
  setCurrentPage: (page: Page) => set({ currentPage: page }),
}));
