import { useState } from "react";
import { useProcessStore, type Process } from "@/stores/process-store";
import { ProcessDetail } from "./ProcessDetail";
import { Loader2, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProcessList() {
  const processes = useProcessStore((s) => s.processes);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const processList = Array.from(processes.values()).sort(
    (a, b) => b.startedAt - a.startedAt,
  );

  if (processList.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
        No active processes
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {processList.map((proc) => (
        <ProcessListItem
          key={proc.id}
          process={proc}
          expanded={expandedId === proc.id}
          onToggle={() =>
            setExpandedId(expandedId === proc.id ? null : proc.id)
          }
        />
      ))}
    </div>
  );
}

function ProcessListItem({
  process,
  expanded,
  onToggle,
}: {
  process: Process;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusIcon = {
    running: <Loader2 className="size-3 animate-spin text-blue-400" />,
    completed: <CheckCircle2 className="size-3 text-green-500" />,
    error: <XCircle className="size-3 text-red-400" />,
  }[process.status];

  const elapsed = process.durationMs
    ? `${(process.durationMs / 1000).toFixed(1)}s`
    : "";

  return (
    <div className={cn("border-b", process.status !== "running" && "opacity-60")}>
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/50"
        onClick={onToggle}
      >
        <ChevronRight
          className={cn(
            "size-3 transition-transform",
            expanded && "rotate-90",
          )}
        />
        {statusIcon}
        <span className="flex-1 truncate text-xs">{process.name}</span>
        {elapsed && (
          <span className="text-[10px] text-muted-foreground">{elapsed}</span>
        )}
      </button>
      {expanded && <ProcessDetail process={process} />}
    </div>
  );
}
