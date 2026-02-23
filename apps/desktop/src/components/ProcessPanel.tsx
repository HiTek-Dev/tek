import { useProcessStore } from "@/stores/process-store";
import { ProcessList } from "@/components/process/ProcessList";
import { LiveLog } from "@/components/process/LiveLog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Tab = "processes" | "logs";

export function ProcessPanel() {
  const panelOpen = useProcessStore((s) => s.panelOpen);
  const setPanelOpen = useProcessStore((s) => s.setPanelOpen);
  const processes = useProcessStore((s) => s.processes);
  const gatewayLogs = useProcessStore((s) => s.gatewayLogs);
  const clearCompleted = useProcessStore((s) => s.clearCompleted);
  const [activeTab, setActiveTab] = useState<Tab>("processes");

  const activeCount = Array.from(processes.values()).filter(
    (p) => p.status === "running",
  ).length;

  return (
    <div
      className="shrink-0 overflow-hidden border-l transition-all duration-200"
      style={{ width: panelOpen ? 320 : 0 }}
    >
      <div className="flex h-full w-[320px] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex gap-1">
            <button
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                activeTab === "processes"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveTab("processes")}
            >
              Processes
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">
                  {activeCount}
                </Badge>
              )}
            </button>
            <button
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                activeTab === "logs"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveTab("logs")}
            >
              Gateway Logs
            </button>
          </div>
          <div className="flex items-center gap-1">
            {activeTab === "processes" && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={clearCompleted}
                title="Clear completed"
              >
                <Trash2 className="size-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPanelOpen(false)}
            >
              <X className="size-3" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "processes" ? (
            <ProcessList />
          ) : (
            <div className="p-2">
              <LiveLog logs={gatewayLogs} maxHeight="calc(100vh - 180px)" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
