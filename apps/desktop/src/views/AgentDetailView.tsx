import { useState } from "react";
import { ArrowLeft, Bot, FileText, Route } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { IdentityEditor } from "@/components/agents/IdentityEditor";
import { ModelRoutingEditor } from "@/components/agents/ModelRoutingEditor";
import { cn } from "@/lib/utils";

type PanelSelection =
  | { kind: "identity"; file: string }
  | { kind: "routing" };

const IDENTITY_FILES = ["SOUL.md", "IDENTITY.md", "STYLE.md", "USER.md"] as const;

export function AgentDetailView() {
  const agentDetailId = useAppStore((s) => s.agentDetailId);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const setAgentDetailId = useAppStore((s) => s.setAgentDetailId);

  const [selected, setSelected] = useState<PanelSelection>({
    kind: "identity",
    file: "SOUL.md",
  });

  const handleBack = () => {
    setAgentDetailId(null);
    setCurrentView("agents");
  };

  if (!agentDetailId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <Bot className="size-10 opacity-40" />
        <h2 className="text-lg font-semibold text-foreground">
          No agent selected
        </h2>
        <Button variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="size-4" />
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon-sm" onClick={handleBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Bot className="size-4 text-primary" />
        <h1 className="text-sm font-semibold text-foreground">
          {agentDetailId}
        </h1>
      </div>

      {/* Two-panel layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel - navigation */}
        <div className="flex w-[220px] shrink-0 flex-col border-r border-border bg-card/50 p-3">
          {/* Identity files section */}
          <div className="mb-1 px-2 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Identity Files
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            {IDENTITY_FILES.map((file) => {
              const isActive =
                selected.kind === "identity" && selected.file === file;

              return (
                <button
                  key={file}
                  onClick={() => setSelected({ kind: "identity", file })}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <FileText className="size-3.5 shrink-0" />
                  {file}
                </button>
              );
            })}
          </div>

          <Separator className="my-3" />

          {/* Model configuration section */}
          <div className="mb-1 px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Model Configuration
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => setSelected({ kind: "routing" })}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                selected.kind === "routing"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Route className="size-3.5 shrink-0" />
              Model Routing
            </button>
          </div>
        </div>

        {/* Right panel - content */}
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {selected.kind === "identity" ? (
            <IdentityEditor
              key={`${agentDetailId}-${selected.file}`}
              agentId={agentDetailId}
              file={selected.file}
            />
          ) : (
            <ModelRoutingEditor
              key={agentDetailId}
              agentId={agentDetailId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
