import { useEffect, useCallback, useRef, useState } from 'react';
import { GatewayStatus } from '../components/GatewayStatus';
import { useGateway } from '../hooks/useGateway';
import { useWebSocket } from '../hooks/useWebSocket';
import { useConfig } from '../hooks/useConfig';
import { useAppStore } from '../stores/app-store';
import { createUsageQueryMessage, createSessionListMessage } from '../lib/gateway-client';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import type { Page } from '../App';

// ── Icons ────────────────────────────────────────────────────────────────

const icons = {
  chat: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  agents: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  settings: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  dollar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  hash: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  arrowUpRight: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  ),
};

// ── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Quick Actions ────────────────────────────────────────────────────────

const quickActions: { label: string; description: string; page: Page; icon: React.ReactNode }[] = [
  { label: 'Open Chat', description: 'Start a conversation with your agent', page: 'chat', icon: icons.chat },
  { label: 'Manage Agents', description: 'Configure your agent personalities', page: 'agents', icon: icons.agents },
  { label: 'Settings', description: 'Keys, models, and preferences', page: 'settings', icon: icons.settings },
];

// ── Types ────────────────────────────────────────────────────────────────

interface UsageStats {
  totalCost: number;
  totalTokens: number;
  requestCount: number;
}

interface SessionInfo {
  sessionId: string;
  sessionKey: string;
  model?: string;
  createdAt: string;
  messageCount: number;
}

// ── Component ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { status, port, pid, startedAt, start, stop } = useGateway();
  const gateway = useAppStore((s) => s.gateway);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const { config } = useConfig();

  // WebSocket connection for dashboard queries
  const wsUrl =
    gateway.status === 'running' && gateway.port
      ? `ws://127.0.0.1:${gateway.port}/gateway`
      : null;
  const ws = useWebSocket(wsUrl);

  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const queriedRef = useRef(false);

  // Message handler for usage and session responses
  const handleMessage = useCallback((msg: unknown) => {
    const m = msg as { type?: string; [key: string]: unknown };
    if (m.type === 'usage.report') {
      const gt = (m.grandTotal ?? m) as { totalCost?: number; totalTokens?: number; requestCount?: number };
      setUsageStats({
        totalCost: gt.totalCost ?? 0,
        totalTokens: gt.totalTokens ?? 0,
        requestCount: gt.requestCount ?? 0,
      });
      setUsageLoading(false);
    } else if (m.type === 'session.list.response' || m.type === 'session.list') {
      const list = (Array.isArray(m.sessions) ? m.sessions : []) as SessionInfo[];
      setSessions(list.slice(0, 5));
      setSessionsLoading(false);
    }
  }, []);

  // Register handler
  useEffect(() => {
    ws.addMessageHandler(handleMessage);
    return () => ws.removeMessageHandler(handleMessage);
  }, [ws.addMessageHandler, ws.removeMessageHandler, handleMessage]);

  // Send queries when connected
  useEffect(() => {
    if (ws.connected && !queriedRef.current) {
      queriedRef.current = true;
      setUsageLoading(true);
      setSessionsLoading(true);
      ws.send(createUsageQueryMessage());
      ws.send(createSessionListMessage());
    }
    if (!ws.connected) {
      queriedRef.current = false;
    }
  }, [ws.connected, ws.send]);

  const isConnected = ws.connected;
  const providers = config?.configuredProviders ?? [];

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1 text-sm">Monitor and control your Tek gateway.</p>
      </div>

      <GatewayStatus
        status={status}
        port={port}
        pid={pid}
        startedAt={startedAt}
        onStart={start}
        onStop={stop}
      />

      {/* Usage Stats Cards */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Usage Stats</h2>
        <div className="grid grid-cols-3 gap-4">
          {/* Total Cost */}
          <div className="bg-surface-secondary border border-surface-overlay rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-text-muted">{icons.dollar}</span>
              <span className="text-xs text-text-muted font-medium">Total Cost</span>
            </div>
            {!isConnected ? (
              <p className="text-lg font-semibold text-text-muted">--</p>
            ) : usageLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-lg font-semibold text-text-primary">
                ${(usageStats?.totalCost ?? 0).toFixed(2)}
              </p>
            )}
          </div>

          {/* Total Tokens */}
          <div className="bg-surface-secondary border border-surface-overlay rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-text-muted">{icons.hash}</span>
              <span className="text-xs text-text-muted font-medium">Total Tokens</span>
            </div>
            {!isConnected ? (
              <p className="text-lg font-semibold text-text-muted">--</p>
            ) : usageLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <p className="text-lg font-semibold text-text-primary">
                {(usageStats?.totalTokens ?? 0).toLocaleString()}
              </p>
            )}
          </div>

          {/* Requests */}
          <div className="bg-surface-secondary border border-surface-overlay rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-text-muted">{icons.arrowUpRight}</span>
              <span className="text-xs text-text-muted font-medium">Requests</span>
            </div>
            {!isConnected ? (
              <p className="text-lg font-semibold text-text-muted">--</p>
            ) : usageLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-lg font-semibold text-text-primary">
                {usageStats?.requestCount ?? 0}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Recent Sessions</h2>
          <button
            onClick={() => setCurrentPage('chat')}
            className="text-xs text-brand-400 hover:text-brand-500 transition-colors"
          >
            View all
          </button>
        </div>
        <div className="bg-surface-secondary border border-surface-overlay rounded-xl divide-y divide-surface-overlay">
          {!isConnected ? (
            <div className="p-4 text-center">
              <p className="text-sm text-text-muted">Connect to gateway to view sessions</p>
            </div>
          ) : sessionsLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <div className="flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))
          ) : sessions && sessions.length > 0 ? (
            sessions.map((s) => (
              <div key={s.sessionId} className="flex items-center gap-3 p-3">
                <span className="text-sm text-text-primary font-mono truncate max-w-[160px]">
                  {s.sessionKey || s.sessionId.slice(0, 12)}
                </span>
                {s.model && <Badge variant="brand">{s.model}</Badge>}
                <span className="text-xs text-text-muted">
                  {s.messageCount} msg{s.messageCount !== 1 ? 's' : ''}
                </span>
                <div className="flex-1" />
                <span className="text-xs text-text-muted">{timeAgo(s.createdAt)}</span>
              </div>
            ))
          ) : (
            <div className="p-4 text-center">
              <p className="text-sm text-text-muted">No sessions yet</p>
            </div>
          )}
        </div>
      </div>

      {/* System Health */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">System Health</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-secondary border border-surface-overlay rounded-xl p-4">
            <p className="text-xs text-text-muted font-medium mb-1">Gateway</p>
            <Badge variant={gateway.status === 'running' ? 'success' : 'error'}>
              {gateway.status === 'running' ? 'Running' : 'Stopped'}
            </Badge>
          </div>
          <div className="bg-surface-secondary border border-surface-overlay rounded-xl p-4">
            <p className="text-xs text-text-muted font-medium mb-1">Memory</p>
            <Badge variant={gateway.status === 'running' ? 'success' : 'default'}>
              {gateway.status === 'running' ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="bg-surface-secondary border border-surface-overlay rounded-xl p-4">
            <p className="text-xs text-text-muted font-medium mb-1">Providers</p>
            <Badge variant={providers.length > 0 ? 'success' : 'warning'}>
              {providers.length} configured
            </Badge>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map(({ label, description, page, icon }) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className="bg-surface-secondary hover:bg-surface-elevated rounded-xl p-4 text-left transition-colors group border border-surface-overlay"
            >
              <span className="block mb-2 text-text-muted group-hover:text-brand-400 transition-colors">{icon}</span>
              <p className="text-sm font-medium text-text-primary group-hover:text-brand-400 transition-colors">{label}</p>
              <p className="text-xs text-text-muted mt-1">{description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
