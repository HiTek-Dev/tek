import type { Process } from "@/stores/process-store";
import { LiveLog } from "./LiveLog";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface ProcessDetailProps {
  process: Process;
}

export function ProcessDetail({ process }: ProcessDetailProps) {
  const statusIcon = {
    running: <Loader2 className="size-3.5 animate-spin text-blue-400" />,
    completed: <CheckCircle2 className="size-3.5 text-green-500" />,
    error: <XCircle className="size-3.5 text-red-400" />,
  }[process.status];

  const elapsed = process.durationMs
    ? `${(process.durationMs / 1000).toFixed(1)}s`
    : process.status === "running"
      ? `${((Date.now() - process.startedAt) / 1000).toFixed(0)}s...`
      : "";

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center gap-2">
        {statusIcon}
        <span className="text-xs font-medium">{process.name}</span>
        <Badge variant="outline" className="text-[9px]">
          {process.type}
        </Badge>
        {elapsed && (
          <span className="ml-auto text-[10px] text-muted-foreground">{elapsed}</span>
        )}
      </div>

      {process.logs.length > 0 && <LiveLog logs={process.logs} maxHeight="200px" />}

      {process.result != null && process.status === "completed" && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Result
          </summary>
          <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-muted p-2 text-[10px]">
            {typeof process.result === "string"
              ? process.result
              : JSON.stringify(process.result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
