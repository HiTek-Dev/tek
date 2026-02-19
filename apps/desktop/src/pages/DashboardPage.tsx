import { GatewayStatus } from '../components/GatewayStatus';
import { useGateway } from '../hooks/useGateway';
import { useAppStore } from '../stores/app-store';
import type { Page } from '../App';

const quickActions: { label: string; description: string; page: Page; icon: string }[] = [
  { label: 'Open Chat', description: 'Start a conversation with your agent', page: 'chat', icon: '\u2709' },
  { label: 'Manage Agents', description: 'Configure your agent personalities', page: 'agents', icon: '\u2663' },
  { label: 'Settings', description: 'Keys, models, and preferences', page: 'settings', icon: '\u2699' },
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
              <span className="text-2xl block mb-2">{icon}</span>
              <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{label}</p>
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
