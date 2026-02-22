import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight } from "lucide-react";

interface ToolCallCardProps {
  toolName: string;
  args: unknown;
  result?: unknown;
  error?: string;
  status: "pending" | "running" | "completed" | "error";
}

const accentColors: Record<ToolCallCardProps["status"], string> = {
  pending: "border-l-muted-foreground",
  running: "border-l-blue-500",
  completed: "border-l-green-500",
  error: "border-l-red-500",
};

export function ToolCallCard({ toolName, args, result, error, status }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon =
    status === "completed" ? (
      <CheckCircle className="size-3.5 text-green-500" />
    ) : status === "error" ? (
      <XCircle className="size-3.5 text-destructive" />
    ) : (
      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
    );

  const argsPreview = args ? JSON.stringify(args).slice(0, 100) : "";

  return (
    <Card
      className={cn(
        "mr-auto max-w-[80%] border-l-4 bg-muted/30 py-1",
        accentColors[status],
      )}
    >
      <CardContent className="p-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center gap-2 text-left text-sm"
        >
          {statusIcon}
          <span className="font-mono text-xs font-bold">{toolName}</span>
          {expanded ? (
            <ChevronDown className="ml-auto size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="ml-auto size-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Collapsed: show first line of args preview */}
        {!expanded && argsPreview && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {argsPreview}
            {argsPreview.length >= 100 ? "..." : ""}
          </p>
        )}

        {/* Expanded: full args, result, error */}
        {expanded && (
          <div className="mt-2 space-y-2">
            {args != null && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Arguments
                </p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            )}
            {result != null && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Result
                </p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                  {typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
            {error != null && (
              <div>
                <p className="text-xs font-medium text-destructive">Error</p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-destructive/10 p-2 text-xs text-destructive">
                  {error}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
