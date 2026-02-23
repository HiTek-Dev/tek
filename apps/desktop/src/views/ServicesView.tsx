import { useState } from "react";
import { MessageSquare, Search, ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TelegramSetup } from "@/components/services/TelegramSetup";
import { BraveSetup } from "@/components/services/BraveSetup";

type ServiceKey = "telegram" | "brave";

interface ServiceInfo {
  key: ServiceKey;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const services: ServiceInfo[] = [
  {
    key: "telegram",
    name: "Telegram",
    description: "Chat interface via Telegram bot with user approval flow",
    icon: MessageSquare,
    category: "Messaging",
  },
  {
    key: "brave",
    name: "Brave Search",
    description: "Web search capabilities powered by Brave Search API",
    icon: Search,
    category: "Search",
  },
];

export function ServicesView() {
  const [selectedService, setSelectedService] = useState<ServiceKey | null>(
    null,
  );

  const handleSelect = (key: ServiceKey) => {
    setSelectedService((prev) => (prev === key ? null : key));
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Services</h2>
        <p className="text-sm text-muted-foreground">
          Configure integrations and external service connections.
        </p>
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {services.map((service) => {
          const Icon = service.icon;
          const isSelected = selectedService === service.key;

          return (
            <Card
              key={service.key}
              className={cn(
                "cursor-pointer transition-colors hover:border-primary/50",
                isSelected && "border-primary",
              )}
              onClick={() => handleSelect(service.key)}
            >
              <CardHeader className="flex-row items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    isSelected
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{service.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      {service.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {service.description}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isSelected && "rotate-180",
                  )}
                />
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Inline Setup Panel */}
      {selectedService === "telegram" && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <TelegramSetup />
        </div>
      )}
      {selectedService === "brave" && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <BraveSetup />
        </div>
      )}
    </div>
  );
}
