import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGatewayRpc } from "@/hooks/useGatewayRpc";
import {
  createVaultKeysList,
  createProviderModelsList,
  type VaultKeysListResult,
  type ProviderModelsListResult,
} from "@/lib/gateway-client";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  currentModel: string | null;
  onSwitch: (model: string) => void;
}

interface ModelOption {
  modelId: string;
  name: string;
  provider: string;
  tier?: "high" | "standard" | "budget";
}

export function ModelSelector({ currentModel, onSwitch }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { request, connected } = useGatewayRpc();

  useEffect(() => {
    if (!connected || loaded) return;

    async function loadModels() {
      try {
        const providersResult = await request<VaultKeysListResult>(createVaultKeysList());
        const configured = providersResult.providers
          .filter((p) => p.configured)
          .map((p) => p.provider);

        const allModels: ModelOption[] = [];
        for (const provider of configured) {
          if (provider === "telegram" || provider === "brave" || provider === "tavily") continue;
          try {
            const result = await request<ProviderModelsListResult>(
              createProviderModelsList(provider),
            );
            for (const m of result.models) {
              allModels.push({
                modelId: `${provider}:${m.modelId}`,
                name: m.name,
                provider,
                tier: m.tier,
              });
            }
          } catch {
            // Skip providers that fail
          }
        }
        setModels(allModels);
        setLoaded(true);
      } catch {
        // Failed to load models
      }
    }

    loadModels();
  }, [connected, loaded, request]);

  if (!currentModel) return null;

  const displayName = currentModel.includes(":")
    ? currentModel.split(":")[1]
    : currentModel;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="xs"
        className="gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        <span>{displayName}</span>
        <ChevronDown className="size-3" />
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-md border bg-popover p-1 shadow-lg">
            <div className="max-h-60 overflow-y-auto">
              {models.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No models available
                </div>
              )}
              {models.map((m) => (
                <button
                  key={m.modelId}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent",
                    currentModel === m.modelId && "bg-accent",
                  )}
                  onClick={() => {
                    onSwitch(m.modelId);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 truncate">{m.name}</span>
                  <span className="text-[10px] text-muted-foreground">{m.provider}</span>
                  {m.tier && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {m.tier}
                    </Badge>
                  )}
                  {currentModel === m.modelId && (
                    <Check className="size-3 text-green-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
