import { useIdentityFiles } from '../hooks/useIdentityFiles';
import { FileEditor } from '../components/FileEditor';
import { IDENTITY_FILES } from '../lib/files';

const DEFAULT_TEMPLATE = `<!-- This file hasn't been created yet. Start writing to define this aspect of your agent's identity. -->\n`;

export function AgentsPage() {
  const { files, activeFile, setActiveFile, setContent, save, saveAll } = useIdentityFiles();

  const activeState = files.get(activeFile);
  const activeInfo = IDENTITY_FILES.find((f) => f.filename === activeFile);
  const hasModified = Array.from(files.values()).some((f) => f.modified);

  const handleCreate = () => {
    setContent(activeFile, DEFAULT_TEMPLATE);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-bold">Agent Identity</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Manage your agent's personality and identity files
        </p>
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
        <span>~/.config/tek/{activeFile}</span>
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
