import { useEffect, useRef, useCallback } from 'react';

interface FileEditorProps {
  content: string;
  onChange: (content: string) => void;
  modified: boolean;
  onSave: () => void;
  loading: boolean;
  readOnly?: boolean;
}

export function FileEditor({ content, onChange, modified, onSave, loading, readOnly }: FileEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    },
    [onSave]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col gap-3 p-4 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-3/4" />
        <div className="h-4 bg-gray-800 rounded w-1/2" />
        <div className="h-4 bg-gray-800 rounded w-5/6" />
        <div className="h-4 bg-gray-800 rounded w-2/3" />
        <div className="h-4 bg-gray-800 rounded w-4/5" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          {modified && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              Unsaved changes
            </span>
          )}
        </div>
        <button
          onClick={onSave}
          disabled={!modified}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            modified
              ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
              : 'bg-gray-800 text-gray-500 cursor-default'
          }`}
        >
          Save
        </button>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        className="flex-1 w-full bg-gray-950 text-gray-200 font-mono text-sm leading-relaxed p-4 resize-none outline-none border-none"
        placeholder="Start typing..."
      />
    </div>
  );
}
