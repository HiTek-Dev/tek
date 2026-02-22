import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GatewayStatus } from "@/components/GatewayStatus";
import { useGateway } from "@/hooks/useGateway";
import { useAppStore } from "@/stores/app-store";
import { MessageSquare } from "lucide-react";

export function LandingView() {
  const { status, port } = useGateway();
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  // Auto-transition to chat when gateway is detected running (with brief delay for visual feedback)
  useEffect(() => {
    if (status !== "running") return;

    const timeout = setTimeout(() => {
      setCurrentView("chat");
    }, 500);

    return () => clearTimeout(timeout);
  }, [status, setCurrentView]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Welcome to Tek
      </h1>

      <GatewayStatus status={status} port={port} />

      {status === "running" && (
        <Button size="lg" onClick={() => setCurrentView("chat")}>
          <MessageSquare className="size-4" />
          Start Chat
        </Button>
      )}

      {status === "stopped" && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            Start the gateway to begin chatting:
          </p>
          <code className="rounded-md bg-muted px-3 py-1.5 text-sm font-mono text-foreground">
            tek gateway start
          </code>
        </div>
      )}

      {status === "unknown" && (
        <p className="text-sm text-muted-foreground">
          Looking for gateway...
        </p>
      )}
    </div>
  );
}
