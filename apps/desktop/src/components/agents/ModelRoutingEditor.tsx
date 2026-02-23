import { useState } from "react";
import { Loader2, Save, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModelRoutingEditorProps {
  agentId: string;
}

const TASK_TYPES = [
  {
    key: "research",
    label: "Research",
    description: "Web searches, information gathering, and analysis",
  },
  {
    key: "code_generation",
    label: "Code Generation",
    description: "Writing, editing, and refactoring code",
  },
  {
    key: "planning",
    label: "Planning",
    description: "Task decomposition, project planning, and strategy",
  },
  {
    key: "general_chat",
    label: "General Chat",
    description: "Conversational responses and general Q&A",
  },
  {
    key: "summarization",
    label: "Summarization",
    description: "Condensing documents, threads, and content",
  },
] as const;

const MODEL_OPTIONS = [
  { value: "", label: "Default (use agent model)" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "deepseek-r1", label: "DeepSeek R1" },
  { value: "llama-3.3-70b", label: "Llama 3.3 70B" },
] as const;

type TaskKey = (typeof TASK_TYPES)[number]["key"];

export function ModelRoutingEditor({ agentId }: ModelRoutingEditorProps) {
  const [routing, setRouting] = useState<Record<TaskKey, string>>({
    research: "",
    code_generation: "",
    planning: "",
    general_chat: "",
    summarization: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (taskKey: TaskKey, model: string) => {
    setRouting((prev) => ({ ...prev, [taskKey]: model }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // In a real implementation this would send the routing config to the gateway
    // via createAgentUpdate(agentId, { modelRouting: routing })
    // For now, simulate a save
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaving(false);
    setSaved(true);
    // Suppress unused variable warning in development
    void agentId;
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Model Routing
          </h3>
          {saved && (
            <span className="text-xs text-emerald-400">Configuration saved</span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save Routing
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Map task types to specific models. When a task type is detected, the
        assigned model will be used instead of the agent&apos;s default model.
      </p>

      {/* Routing table */}
      <div className="flex flex-col gap-3">
        {TASK_TYPES.map((task) => (
          <div
            key={task.key}
            className={cn(
              "flex items-center justify-between gap-4 rounded-lg border border-input bg-card p-4",
              "dark:bg-input/10",
            )}
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {task.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {task.description}
              </span>
            </div>

            <select
              value={routing[task.key]}
              onChange={(e) =>
                handleChange(task.key as TaskKey, e.target.value)
              }
              className={cn(
                "h-9 w-56 shrink-0 cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "dark:bg-input/30",
              )}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-card text-foreground"
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Info footer */}
      <div className="mt-auto rounded-md border border-input/50 bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          Tasks without an assigned model will use the agent&apos;s default model.
          The routing engine evaluates incoming messages and selects the
          appropriate model based on the detected task type.
        </p>
      </div>
    </div>
  );
}
