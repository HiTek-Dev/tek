import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useGatewayRpc } from "@/hooks/useGatewayRpc";
import {
  createVaultKeysList,
  createVaultKeysSet,
  createVaultKeysTest,
  createOllamaDiscover,
} from "@/lib/gateway-client";
import type {
  VaultKeysListResult,
  VaultKeysSetResult,
  VaultKeysTestResult,
  OllamaDiscoverResult,
} from "@/lib/gateway-client";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { ProviderDetail } from "@/components/providers/ProviderDetail";

interface ProviderInfo {
  provider: string;
  name: string;
  configured: boolean;
}

const PROVIDER_DEFINITIONS: Omit<ProviderInfo, "configured">[] = [
  { provider: "anthropic", name: "Anthropic" },
  { provider: "openai", name: "OpenAI" },
  { provider: "google", name: "Google" },
  { provider: "venice", name: "Venice" },
  { provider: "ollama", name: "Ollama" },
];

export function ProvidersView() {
  const { request, connected } = useGatewayRpc();
  const [providers, setProviders] = useState<ProviderInfo[]>(
    PROVIDER_DEFINITIONS.map((d) => ({ ...d, configured: false })),
  );
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch configured status on mount and when connection changes
  const fetchProviders = useCallback(async () => {
    if (!connected) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const msg = createVaultKeysList();
      const result = await request<VaultKeysListResult>(msg);
      if (result.type === "vault.keys.list.result" && result.providers) {
        setProviders(
          PROVIDER_DEFINITIONS.map((def) => {
            const match = result.providers.find(
              (p) => p.provider === def.provider,
            );
            return { ...def, configured: match?.configured ?? false };
          }),
        );
      }
    } catch {
      // Silently handle -- providers remain showing as not configured
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleSave = async (provider: string, value: string) => {
    if (!connected) return;
    try {
      const msg = createVaultKeysSet(provider, value);
      const result = await request<VaultKeysSetResult>(msg);
      if (result.type === "vault.keys.set.result" && result.success) {
        // Refresh provider list to reflect new status
        await fetchProviders();
      }
    } catch {
      // Error handling could be added here
    }
  };

  const handleTest = async (
    provider: string,
  ): Promise<{ valid: boolean; error?: string }> => {
    if (!connected) return { valid: false, error: "Not connected to gateway" };
    try {
      const msg = createVaultKeysTest(provider);
      const result = await request<VaultKeysTestResult>(msg);
      if (result.type === "vault.keys.test.result") {
        return { valid: result.valid, error: result.error };
      }
      return { valid: false, error: "Unexpected response" };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : "Test failed",
      };
    }
  };

  const handleDiscover = async (url: string) => {
    if (!connected) return;
    try {
      const msg = createOllamaDiscover(url);
      await request<OllamaDiscoverResult>(msg);
      // Discovery results would feed into a ModelTable in a future iteration
    } catch {
      // Error handling could be added here
    }
  };

  const selected = providers.find((p) => p.provider === selectedProvider);

  if (loading && connected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="size-8 animate-spin opacity-40" />
        <p className="text-sm">Loading providers...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <KeyRound className="size-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Providers
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage API keys and model configuration for your AI providers.
            </p>
          </div>
        </div>

        {/* Connection warning */}
        {!connected && (
          <div className="mb-4 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Gateway is not connected. Start the gateway to manage provider keys.
          </div>
        )}

        {/* Provider grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.provider}
              name={p.name}
              provider={p.provider}
              configured={p.configured}
              active={selectedProvider === p.provider}
              onClick={() =>
                setSelectedProvider(
                  selectedProvider === p.provider ? null : p.provider,
                )
              }
            />
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <ProviderDetail
            provider={selected.provider}
            name={selected.name}
            configured={selected.configured}
            onSave={(value) => handleSave(selected.provider, value)}
            onTest={handleTest}
            onDiscover={
              selected.provider === "ollama" ? handleDiscover : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
