import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { GatewayStatus } from "@/components/GatewayStatus";
import { NavSidebar } from "@/components/NavSidebar";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const gateway = useAppStore((s) => s.gateway);
  const currentView = useAppStore((s) => s.currentView);
  const navOpen = useAppStore((s) => s.navOpen);
  const toggleNav = useAppStore((s) => s.toggleNav);

  const showNav = currentView !== "landing" && currentView !== "onboarding";

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header bar */}
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {showNav && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={toggleNav}
            >
              <Menu className="size-4" />
            </Button>
          )}
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Tek
          </span>
        </div>
        <GatewayStatus
          status={gateway.status}
          port={gateway.port}
          compact
        />
      </header>

      <Separator />

      {/* Content area with optional nav sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {showNav && (
          <div
            className="shrink-0 overflow-hidden transition-all duration-200"
            style={{ width: navOpen ? 240 : 0 }}
          >
            <NavSidebar />
          </div>
        )}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
