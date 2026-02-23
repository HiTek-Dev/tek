import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { useGatewayControl } from "@/hooks/useGatewayControl";
import { useGatewayRpc } from "@/hooks/useGatewayRpc";
import { useProcessStore } from "@/stores/process-store";
import { LiveLog } from "@/components/process/LiveLog";
import { createGatewayStatus, type GatewayStatusResult } from "@/lib/gateway-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Server,
  Play,
  Square,
  RotateCcw,
  Loader2,
  Clock,
  Cpu,
  Network,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function GatewayView() {
  const gateway = useAppStore((s) => s.gateway);
  const {
    startGateway,
    stopGateway,
    restartGateway,
    actionInProgress,
    error: controlError,
  } = useGatewayControl();
  const { request, connected } = useGatewayRpc();
  const gatewayLogs = useProcessStore((s) => s.gatewayLogs);
  const [status, setStatus] = useState<GatewayStatusResult | null>(null);
  const [activeTab, setActiveTab] = useState<"status" | "logs">("status");

  // Fetch gateway status
  useEffect(() => {
    if (!connected) {
      setStatus(null);
      return;
    }

    async function fetchStatus() {
      try {
        const result = await request<GatewayStatusResult>(createGatewayStatus());
        if (result.type === "gateway.status.result") {
          setStatus(result);
        }
      } catch {
        // Gateway may not support this message yet
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 10_000);
    return () => clearInterval(interval);
  }, [connected, request]);

  const isRunning = gateway.status === "running";
  const isActionLoading = actionInProgress !== null;

  const formatUptime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Server className="size-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Gateway</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and control the Tek gateway process.
          </p>
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-3">
        <Badge
          variant={isRunning ? "secondary" : "outline"}
          className="gap-1.5"
        >
          <span
            className={cn(
              "size-2 rounded-full",
              isRunning ? "bg-green-500" : "bg-red-500",
            )}
          />
          {isRunning ? "Running" : "Stopped"}
        </Badge>
        {gateway.port && (
          <span className="text-xs text-muted-foreground">
            Port {gateway.port}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!isRunning ? (
          <Button
            onClick={startGateway}
            disabled={isActionLoading}
            size="sm"
          >
            {actionInProgress === "starting" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Start
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={stopGateway}
              disabled={isActionLoading}
              size="sm"
            >
              {actionInProgress === "stopping" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Square className="size-3.5" />
              )}
              Stop
            </Button>
            <Button
              variant="outline"
              onClick={restartGateway}
              disabled={isActionLoading}
              size="sm"
            >
              {actionInProgress === "restarting" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              Restart
            </Button>
          </>
        )}
      </div>

      {controlError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {controlError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          className={cn(
            "px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "status"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("status")}
        >
          Status
        </button>
        <button
          className={cn(
            "px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "logs"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("logs")}
        >
          Logs
        </button>
      </div>

      {activeTab === "status" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-2">
              <Clock className="size-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Uptime
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold">
                {status ? formatUptime(status.uptime) : isRunning ? "..." : "--"}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-2">
              <Cpu className="size-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium text-muted-foreground">
                PID
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold">
                {status?.pid ?? gateway.pid ?? "--"}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-2">
              <Network className="size-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Connections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold">
                {status?.connections ?? "--"}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2 pb-2">
              <Users className="size-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-semibold">
                {status?.sessions ?? "--"}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "status" && status?.providers && status.providers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Configured Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {status.providers.map((p) => (
                <Badge
                  key={p.provider}
                  variant={p.configured ? "secondary" : "outline"}
                >
                  <span
                    className={cn(
                      "mr-1 size-1.5 rounded-full",
                      p.configured ? "bg-green-500" : "bg-gray-400",
                    )}
                  />
                  {p.provider}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "logs" && (
        <LiveLog logs={gatewayLogs} maxHeight="calc(100vh - 350px)" />
      )}
    </div>
  );
}
