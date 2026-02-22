import { Loader2, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GatewayStatusProps {
  status: "unknown" | "running" | "stopped";
  port: number | null;
  /** Compact mode for header bar display */
  compact?: boolean;
}

export function GatewayStatus({
  status,
  port,
  compact = false,
}: GatewayStatusProps) {
  const dotColor = {
    running: "bg-green-500",
    stopped: "bg-red-500",
    unknown: "bg-gray-400 animate-pulse",
  }[status];

  const Icon = {
    running: Wifi,
    stopped: WifiOff,
    unknown: Loader2,
  }[status];

  const label = {
    running: `Connected on port ${port}`,
    stopped: "Gateway not detected",
    unknown: "Checking...",
  }[status];

  const variant = {
    running: "secondary" as const,
    stopped: "outline" as const,
    unknown: "outline" as const,
  }[status];

  if (compact) {
    return (
      <Badge variant={variant} className="gap-1.5">
        <span className={cn("size-2 rounded-full", dotColor)} />
        <span className="text-xs">{status === "running" ? "Connected" : status === "stopped" ? "Disconnected" : "Checking"}</span>
      </Badge>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <span className={cn("size-3 rounded-full", dotColor)} />
        <Icon
          className={cn(
            "size-5",
            status === "unknown" && "animate-spin",
            status === "running" && "text-green-500",
            status === "stopped" && "text-red-500",
            status === "unknown" && "text-muted-foreground",
          )}
        />
      </div>
      <Badge variant={variant} className="text-sm">
        {label}
      </Badge>
    </div>
  );
}
