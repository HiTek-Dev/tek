import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { GatewayStatus } from "@/components/GatewayStatus";
import { useAppStore } from "@/stores/app-store";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const gateway = useAppStore((s) => s.gateway);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header bar */}
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Tek
        </span>
        <GatewayStatus
          status={gateway.status}
          port={gateway.port}
          compact
        />
      </header>

      <Separator />

      {/* Content area */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
