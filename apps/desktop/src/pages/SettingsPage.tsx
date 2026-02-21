import { useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import { Tabs } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

const settingsTabs = [
  { id: 'general', label: 'General' },
  { id: 'providers', label: 'Providers' },
  { id: 'aliases', label: 'Model Aliases' },
  { id: 'mcp', label: 'MCP Servers' },
  { id: 'gateway', label: 'Gateway Info' },
];

export function SettingsPage() {
  const { config, loading, error, modified, updateField, save, reload } = useConfig();
  const [activeTab, setActiveTab] = useState('general');
  const [newAliasName, setNewAliasName] = useState('');
  const [newAliasModel, setNewAliasModel] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await save();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addAlias = () => {
    if (!newAliasName.trim() || !newAliasModel.trim()) return;
    const aliases = { ...(config?.modelAliases ?? {}), [newAliasName.trim()]: newAliasModel.trim() };
    updateField('modelAliases', aliases);
    setNewAliasName('');
    setNewAliasModel('');
  };

  const removeAlias = (name: string) => {
    const aliases = { ...(config?.modelAliases ?? {}) };
    delete aliases[name];
    updateField('modelAliases', aliases);
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Settings</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-secondary rounded-lg p-6">
              <Skeleton className="h-5 w-1/4 mb-3" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Settings</h1>
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          <p className="font-semibold">Failed to load configuration</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={reload}
            className="mt-3 px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const providers = config?.configuredProviders ?? [];
  const aliases: Record<string, string> = (config?.modelAliases && typeof config.modelAliases === 'object' && !Array.isArray(config.modelAliases))
    ? config.modelAliases
    : {};
  const mcpServers = config?.mcpServers ?? {};
  const mcpEntries = Object.entries(mcpServers);

  return (
    <div className="p-6 max-w-3xl flex flex-col h-full">
      <h1 className="text-2xl font-bold text-text-primary mb-4">Settings</h1>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4 text-red-200 text-sm">
          {error}
        </div>
      )}

      <Tabs tabs={settingsTabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto mt-4">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="bg-surface-secondary border border-surface-overlay rounded-xl p-6 space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Default Model</label>
              <input
                type="text"
                value={config?.defaultModel ?? ''}
                onChange={(e) => updateField('defaultModel', e.target.value)}
                placeholder="e.g. anthropic:claude-sonnet-4-5-20250514"
                className="w-full bg-surface-primary border border-surface-overlay rounded px-3 py-2 text-text-primary text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Security Mode</label>
              <Badge variant={config?.securityMode === 'limited' ? 'warning' : 'success'}>
                {config?.securityMode ?? 'full'}
              </Badge>
              <p className="text-xs text-text-muted mt-1">
                Change via CLI: <code className="text-text-secondary">tek init</code>
              </p>
            </div>
            {config?.securityMode === 'limited' && config?.workspaceDir && (
              <div>
                <label className="block text-sm text-text-secondary mb-1">Workspace Directory</label>
                <p className="text-sm text-text-primary font-mono">{config.workspaceDir}</p>
              </div>
            )}
          </div>
        )}

        {/* Providers Tab */}
        {activeTab === 'providers' && (
          <div className="bg-surface-secondary border border-surface-overlay rounded-xl p-6 animate-fade-in">
            {providers.length > 0 ? (
              <div className="space-y-2">
                {providers.map((provider) => (
                  <div
                    key={provider}
                    className="flex items-center justify-between bg-surface-primary border border-surface-overlay rounded-lg px-4 py-3"
                  >
                    <span className="text-sm text-text-primary font-medium">{provider}</span>
                    <Badge variant="success">Configured</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No providers configured</p>
            )}
            <p className="text-xs text-text-muted mt-4">
              Provider health is determined by key configuration status.
            </p>
            <p className="text-xs text-text-muted mt-1">
              API keys are managed securely via the CLI. Run <code className="text-text-secondary">tek keys</code> to manage.
            </p>
          </div>
        )}

        {/* Model Aliases Tab */}
        {activeTab === 'aliases' && (
          <div className="bg-surface-secondary border border-surface-overlay rounded-xl p-6 animate-fade-in">
            {Object.keys(aliases).length > 0 ? (
              <div className="space-y-2 mb-4">
                {Object.entries(aliases).map(([name, model]) => (
                  <div key={name} className="flex items-center gap-3 bg-surface-primary border border-surface-overlay rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-brand-400 min-w-[80px]">{name}</span>
                    <span className="text-text-muted text-xs">&rarr;</span>
                    <span className="text-sm text-text-primary flex-1 font-mono truncate">{model}</span>
                    <button
                      onClick={() => removeAlias(name)}
                      className="text-text-muted hover:text-red-400 text-sm px-1"
                      title="Remove alias"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted mb-4">No aliases defined</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newAliasName}
                onChange={(e) => setNewAliasName(e.target.value)}
                placeholder="Alias name"
                className="bg-surface-primary border border-surface-overlay rounded px-3 py-1.5 text-sm text-text-primary w-32 focus:border-brand-500 focus:outline-none"
              />
              <input
                type="text"
                value={newAliasModel}
                onChange={(e) => setNewAliasModel(e.target.value)}
                placeholder="Target model"
                className="bg-surface-primary border border-surface-overlay rounded px-3 py-1.5 text-sm text-text-primary flex-1 focus:border-brand-500 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && addAlias()}
              />
              <button
                onClick={addAlias}
                disabled={!newAliasName.trim() || !newAliasModel.trim()}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:bg-surface-elevated disabled:text-text-muted rounded text-sm text-white"
              >
                Add
              </button>
            </div>
            <p className="text-xs text-text-muted mt-2">Changes apply on save</p>
          </div>
        )}

        {/* MCP Servers Tab */}
        {activeTab === 'mcp' && (
          <div className="bg-surface-secondary border border-surface-overlay rounded-xl p-6 animate-fade-in">
            {mcpEntries.length > 0 ? (
              <div className="space-y-2">
                {mcpEntries.map(([name, server]) => (
                  <div key={name} className="bg-surface-primary border border-surface-overlay rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-purple-300">{name}</span>
                    <p className="text-xs text-text-secondary font-mono mt-1">
                      {server.command}{server.args?.length ? ` ${server.args.join(' ')}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No MCP servers configured</p>
            )}
            <p className="text-xs text-text-muted mt-3">
              MCP servers are managed via the config file or CLI
            </p>
          </div>
        )}

        {/* Gateway Info Tab */}
        {activeTab === 'gateway' && (
          <div className="bg-surface-secondary border border-surface-overlay rounded-xl p-6 animate-fade-in">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Config file</span>
                <span className="text-text-primary font-mono text-xs">~/.config/tek/config.json</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Database</span>
                <span className="text-text-primary font-mono text-xs">~/.config/tek/tek.db</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions (always visible) */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-surface-overlay">
        <button
          onClick={handleSave}
          disabled={!modified}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            modified
              ? 'bg-brand-600 hover:bg-brand-500 text-white'
              : 'bg-surface-elevated text-text-muted cursor-not-allowed'
          }`}
        >
          Save Changes
        </button>
        <button
          onClick={reload}
          className="px-4 py-2 bg-surface-elevated hover:bg-surface-overlay rounded text-sm text-text-secondary"
        >
          Reload
        </button>
        {saved && (
          <span className="text-green-400 text-sm">Changes saved</span>
        )}
        {modified && !saved && (
          <span className="text-yellow-400 text-sm">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
