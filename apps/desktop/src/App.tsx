import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ChatPage } from './pages/ChatPage';
import { AgentsPage } from './pages/AgentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAppStore } from './stores/app-store';

export type Page = 'dashboard' | 'chat' | 'agents' | 'settings';

const pages: Record<Page, () => React.JSX.Element> = {
  dashboard: DashboardPage,
  chat: ChatPage,
  agents: AgentsPage,
  settings: SettingsPage,
};

export function App() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const ActivePage = pages[currentPage];

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      <ActivePage />
    </Layout>
  );
}
