import { useState, useCallback } from 'react';
import { useConfig } from '../hooks/useConfig';
import { useIdentityFiles } from '../hooks/useIdentityFiles';
import { FileEditor } from '../components/FileEditor';
import { IDENTITY_FILES, ensureAgentDir, saveIdentityFile } from '../lib/files';
import type { AgentDefinition } from '../lib/config';

type View = 'list' | 'create' | 'detail';

const DEFAULT_TEMPLATE = `<!-- This file hasn't been created yet. Start writing to define this aspect of your agent's identity. -->\n`;

// Default agent represents the global memory directory
const DEFAULT_AGENT: AgentDefinition = {
  id: 'default',
  name: 'Default Agent',
  description: 'Global agent using ~/.config/tek/memory/',
  accessMode: 'full',
};

function generateId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function AgentsPage() {
  const { config, updateField, save: saveConfig } = useConfig();
  const [view, setView] = useState<View>('list');
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAccessMode, setFormAccessMode] = useState<'full' | 'limited'>('full');
  const [creating, setCreating] = useState(false);

  const agents: AgentDefinition[] = config?.agents?.list ?? [];

  const selectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setView('detail');
  }, []);

  const goToList = useCallback(() => {
    setView('list');
    setSelectedAgentId(undefined);
  }, []);

  const openCreate = useCallback(() => {
    setFormName('');
    setFormDescription('');
    setFormAccessMode('full');
    setView('create');
  }, []);

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) return;
    setCreating(true);

    try {
      const id = generateId(formName);

      // Create agent directory and seed identity files
      await ensureAgentDir(id);
      for (const file of IDENTITY_FILES) {
        await saveIdentityFile(file.filename, DEFAULT_TEMPLATE, id);
      }

      // Add to config
      const newAgent: AgentDefinition = {
        id,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        accessMode: formAccessMode,
      };

      const currentAgents = config?.agents ?? { list: [], defaultAgentId: 'default' };
      const updatedList = [...currentAgents.list, newAgent];
      updateField('agents', { ...currentAgents, list: updatedList });

      // Save config immediately
      await saveConfig();

      // Navigate to the new agent's detail view
      setSelectedAgentId(id);
      setView('detail');
    } catch (err) {
      console.error('Failed to create agent:', err);
    } finally {
      setCreating(false);
    }
  }, [formName, formDescription, formAccessMode, config, updateField, saveConfig]);

  if (view === 'create') {
    return <CreateView
      formName={formName}
      setFormName={setFormName}
      formDescription={formDescription}
      setFormDescription={setFormDescription}
      formAccessMode={formAccessMode}
      setFormAccessMode={setFormAccessMode}
      creating={creating}
      onSubmit={handleCreate}
      onBack={goToList}
    />;
  }

  if (view === 'detail' && selectedAgentId) {
    const agent = selectedAgentId === 'default'
      ? DEFAULT_AGENT
      : agents.find((a) => a.id === selectedAgentId);

    return <DetailView
      agent={agent ?? { id: selectedAgentId, name: selectedAgentId }}
      onBack={goToList}
    />;
  }

  // List view (default)
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Manage your agents and their identity files
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors cursor-pointer"
        >
          + Create Agent
        </button>
      </div>

      <div className="space-y-3">
        {/* Default agent card */}
        <AgentCard agent={DEFAULT_AGENT} onSelect={selectAgent} />

        {/* User-created agents */}
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onSelect={selectAgent} />
        ))}

        {agents.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">
            No custom agents yet. The default agent uses your global identity files.
          </p>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent, onSelect }: { agent: AgentDefinition; onSelect: (id: string) => void }) {
  const mode = agent.accessMode ?? 'full';

  return (
    <button
      onClick={() => onSelect(agent.id)}
      className="w-full text-left bg-gray-800 hover:bg-gray-750 rounded-lg p-4 transition-colors cursor-pointer border border-gray-700 hover:border-gray-600"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-300">
            {(agent.name ?? agent.id).charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-100">{agent.name ?? agent.id}</h3>
            {agent.description && (
              <p className="text-xs text-gray-400 mt-0.5">{agent.description}</p>
            )}
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          mode === 'full'
            ? 'bg-green-900/50 text-green-300 border border-green-700'
            : 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
        }`}>
          {mode === 'full' ? 'Full' : 'Limited'}
        </span>
      </div>
    </button>
  );
}

function CreateView({
  formName,
  setFormName,
  formDescription,
  setFormDescription,
  formAccessMode,
  setFormAccessMode,
  creating,
  onSubmit,
  onBack,
}: {
  formName: string;
  setFormName: (v: string) => void;
  formDescription: string;
  setFormDescription: (v: string) => void;
  formAccessMode: 'full' | 'limited';
  setFormAccessMode: (v: 'full' | 'limited') => void;
  creating: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const generatedId = generateId(formName);

  return (
    <div className="p-6 max-w-3xl">
      <button
        onClick={onBack}
        className="text-sm text-gray-400 hover:text-gray-200 mb-4 cursor-pointer"
      >
        &larr; Back to Agents
      </button>
      <h1 className="text-2xl font-bold mb-6">Create Agent</h1>

      <div className="space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name *</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Research Assistant"
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100 text-sm focus:border-blue-500 focus:outline-none"
          />
          {formName.trim() && (
            <p className="text-xs text-gray-500 mt-1">
              ID: <code className="text-gray-400">{generatedId}</code> &mdash; Directory: <code className="text-gray-400">~/.config/tek/agents/{generatedId}/</code>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="What does this agent do?"
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100 text-sm focus:border-blue-500 focus:outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Access Mode</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="accessMode"
                value="full"
                checked={formAccessMode === 'full'}
                onChange={() => setFormAccessMode('full')}
                className="accent-blue-500"
              />
              <div>
                <span className="text-sm text-gray-200">Full Control</span>
                <p className="text-xs text-gray-500">Agent can access all tools and files</p>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="accessMode"
                value="limited"
                checked={formAccessMode === 'limited'}
                onChange={() => setFormAccessMode('limited')}
                className="accent-blue-500"
              />
              <div>
                <span className="text-sm text-gray-200">Limited</span>
                <p className="text-xs text-gray-500">Restricted to workspace directory</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onSubmit}
            disabled={!formName.trim() || creating}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              formName.trim() && !creating
                ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {creating ? 'Creating...' : 'Create Agent'}
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailView({ agent, onBack }: { agent: AgentDefinition; onBack: () => void }) {
  const agentId = agent.id === 'default' ? undefined : agent.id;
  const { files, activeFile, setActiveFile, setContent, save, saveAll } = useIdentityFiles(agentId);

  const activeState = files.get(activeFile);
  const activeInfo = IDENTITY_FILES.find((f) => f.filename === activeFile);
  const hasModified = Array.from(files.values()).some((f) => f.modified);
  const mode = agent.accessMode ?? 'full';

  const handleCreate = () => {
    setContent(activeFile, DEFAULT_TEMPLATE);
  };

  const basePath = agent.id === 'default'
    ? '~/.config/tek/memory'
    : `~/.config/tek/agents/${agent.id}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-200 mb-3 cursor-pointer"
        >
          &larr; Back to Agents
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-300">
            {(agent.name ?? agent.id).charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{agent.name ?? agent.id}</h1>
            {agent.description && (
              <p className="text-gray-400 text-sm">{agent.description}</p>
            )}
          </div>
          <span className={`ml-auto px-2.5 py-1 rounded text-xs font-medium ${
            mode === 'full'
              ? 'bg-green-900/50 text-green-300 border border-green-700'
              : 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
          }`}>
            {mode === 'full' ? 'Full Control' : 'Limited'}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-800 px-6">
        {IDENTITY_FILES.map((file) => {
          const isActive = file.filename === activeFile;
          const state = files.get(file.filename);
          const isModified = state?.modified ?? false;

          return (
            <button
              key={file.filename}
              onClick={() => setActiveFile(file.filename)}
              className={`relative px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                isActive
                  ? 'text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title={file.description}
            >
              <span className="flex items-center gap-1.5">
                {file.name}
                {isModified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeState?.loading ? (
          <FileEditor
            content=""
            onChange={() => {}}
            modified={false}
            onSave={() => {}}
            loading={true}
          />
        ) : activeState?.content === null ? (
          /* File not found state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
            <div className="text-4xl opacity-30">+</div>
            <p className="text-lg">This file hasn't been created yet</p>
            <p className="text-sm text-gray-500">
              {activeInfo?.description}
            </p>
            <button
              onClick={handleCreate}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors cursor-pointer"
            >
              Create {activeInfo?.name} File
            </button>
          </div>
        ) : (
          <FileEditor
            content={activeState?.content ?? ''}
            onChange={(content) => setContent(activeFile, content)}
            modified={activeState?.modified ?? false}
            onSave={() => save(activeFile)}
            loading={false}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800 text-xs text-gray-500">
        <span>{basePath}/{activeFile}</span>
        {hasModified && (
          <button
            onClick={saveAll}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer"
          >
            Save All
          </button>
        )}
      </div>
    </div>
  );
}
