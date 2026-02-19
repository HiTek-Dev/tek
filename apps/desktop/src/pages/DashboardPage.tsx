import { GatewayStatus } from '../components/GatewayStatus';
import { useGateway } from '../hooks/useGateway';
import { useAppStore } from '../stores/app-store';
import type { Page } from '../App';

const quickActionIcons: Record<string, React.ReactNode> = {
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
};

const quickActions: { label: string; description: string; page: Page; icon: React.ReactNode }[] = [
  { label: 'Open Chat', description: 'Start a conversation with your agent', page: 'chat', icon: quickActionIcons.chat },
  { label: 'Manage Agents', description: 'Configure your agent personalities', page: 'agents', icon: quickActionIcons.agents },
  { label: 'Settings', description: 'Keys, models, and preferences', page: 'settings', icon: quickActionIcons.settings },
];

export function DashboardPage() {
  const { status, port, pid, startedAt, start, stop } = useGateway();
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1 text-sm">Monitor and control your Tek gateway.</p>
      </div>

      <GatewayStatus
        status={status}
        port={port}
        pid={pid}
        startedAt={startedAt}
        onStart={start}
        onStop={stop}
      />

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map(({ label, description, page, icon }) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-left transition-colors group"
            >
              <span className="block mb-2 text-gray-400 group-hover:text-blue-400 transition-colors">{icon}</span>
              <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{label}</p>
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
