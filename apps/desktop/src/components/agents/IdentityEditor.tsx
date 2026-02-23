import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, Save } from "lucide-react";
import { useGatewayRpc } from "@/hooks/useGatewayRpc";
import {
  createAgentIdentityRead,
  createAgentIdentityWrite,
  type AgentIdentityReadResult,
  type ServerMessage,
} from "@/lib/gateway-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IdentityEditorProps {
  agentId: string;
  file: string;
}

export function IdentityEditor({ agentId, file }: IdentityEditorProps) {
  const { request, connected } = useGatewayRpc();

  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = content !== savedContent;

  // Load content on mount and when agentId/file changes
  useEffect(() => {
    if (!connected) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(false);

    request<AgentIdentityReadResult>(createAgentIdentityRead(agentId, file))
      .then((res) => {
        if (cancelled) return;
        const text = res.exists ? res.content : "";
        setContent(text);
        setSavedContent(text);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load file");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, file, connected, request]);

  const handleSave = useCallback(async () => {
    if (!connected) return;

    setSaving(true);
    setError(null);

    try {
      const res = await request<ServerMessage>(
        createAgentIdentityWrite(agentId, file, content),
      );

      if ("success" in res && res.success) {
        setSavedContent(content);
      } else if ("error" in res && typeof res.error === "string") {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setSaving(false);
    }
  }, [agentId, file, content, connected, request]);

  // Auto-save with debounce (2 seconds after last keystroke)
  useEffect(() => {
    if (!isDirty || !connected) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [content, connected, isDirty, handleSave]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading {file}...
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{file}</h3>
          {isDirty && !saving && (
            <span className="text-xs text-amber-400">Unsaved changes</span>
          )}
          {saving && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Saving...
            </span>
          )}
          {!isDirty && !saving && savedContent.length > 0 && (
            <span className="text-xs text-emerald-400">Saved</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreview((p) => !p)}
            title={preview ? "Show editor" : "Show preview"}
          >
            {preview ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            {preview ? "Edit" : "Preview"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saving || !connected}
          >
            <Save className="size-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Editor / Preview */}
      <div className="relative min-h-0 flex-1">
        {preview ? (
          <div
            className={cn(
              "prose dark:prose-invert h-full max-w-none overflow-auto rounded-md border border-input bg-card p-4 text-sm",
            )}
            dangerouslySetInnerHTML={{
              __html: markdownToHtml(content),
            }}
          />
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={cn(
              "h-full w-full resize-none rounded-md border border-input bg-transparent p-4 font-mono text-sm leading-relaxed text-foreground shadow-xs outline-none transition-colors",
              "placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "dark:bg-input/30",
            )}
            placeholder={`Write your ${file} content here...\n\nUse Markdown syntax for formatting.`}
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Minimal markdown-to-HTML converter for preview.
 * Handles headings, bold, italic, code blocks, inline code, lists, and paragraphs.
 */
function markdownToHtml(md: string): string {
  if (!md.trim()) {
    return '<p class="text-muted-foreground italic">No content yet.</p>';
  }

  let html = md
    // Escape HTML entities
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Fenced code blocks
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre class="rounded-md bg-muted p-3 text-xs"><code>$2</code></pre>',
  );

  // Headings
  html = html.replace(
    /^#### (.+)$/gm,
    '<h4 class="text-sm font-semibold mt-3 mb-1">$1</h4>',
  );
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 class="text-base font-semibold mt-4 mb-1">$1</h3>',
  );
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>',
  );
  html = html.replace(
    /^# (.+)$/gm,
    '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>',
  );

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-muted px-1.5 py-0.5 text-xs">$1</code>',
  );

  // Unordered list items
  html = html.replace(
    /^[-*] (.+)$/gm,
    '<li class="ml-4 list-disc text-sm">$1</li>',
  );

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="my-3 border-border" />');

  // Line breaks into paragraphs (double newlines)
  html = html
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<li") ||
        trimmed.startsWith("<hr")
      ) {
        return trimmed;
      }
      return `<p class="text-sm leading-relaxed mb-2">${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  return html;
}
