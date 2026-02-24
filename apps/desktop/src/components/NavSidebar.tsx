import { useAppStore, type View } from "@/stores/app-store";
import { NavItem } from "@/components/ui/nav-item";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Bot, KeyRound, Puzzle, Server } from "lucide-react";

function gatewayDot(status: "unknown" | "running" | "stopped"): "green" | "red" | "gray" {
  if (status === "running") return "green";
  if (status === "stopped") return "red";
  return "gray";
}

export function NavSidebar() {
  const currentView = useAppStore((s) => s.currentView);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const gatewayStatus = useAppStore((s) => s.gateway.status);
  const hasConfiguredProvider = useAppStore((s) => s.hasConfiguredProvider);

  const navigate = (view: View) => {
    setCurrentView(view);
  };

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r bg-sidebar-background">
      <div className="flex flex-col gap-1 p-3">
        <NavItem
          icon={MessageSquare}
          label="Chat"
          active={currentView === "chat"}
          onClick={() => navigate("chat")}
          statusDot={gatewayDot(gatewayStatus)}
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-1 p-3">
        <span className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Agent Setup
        </span>
        <NavItem
          icon={Bot}
          label="Agents"
          active={currentView === "agents" || currentView === "agent-detail"}
          onClick={() => navigate("agents")}
          disabled={!hasConfiguredProvider}
          tooltip={!hasConfiguredProvider ? "Configure a provider first" : undefined}
        />
        <NavItem
          icon={KeyRound}
          label="Providers"
          active={currentView === "providers"}
          onClick={() => navigate("providers")}
        />
        <NavItem
          icon={Puzzle}
          label="Services"
          active={currentView === "services"}
          onClick={() => navigate("services")}
        />
      </div>

      <div className="mt-auto">
        <Separator />
        <div className="p-3">
          <NavItem
            icon={Server}
            label="Gateway"
            active={currentView === "gateway"}
            onClick={() => navigate("gateway")}
            statusDot={gatewayDot(gatewayStatus)}
          />
        </div>
      </div>
    </aside>
  );
}
