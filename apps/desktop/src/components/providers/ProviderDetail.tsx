import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, FlaskConical, Save, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModelTable } from "./ModelTable";
import { FallbackChainEditor } from "./FallbackChainEditor";

interface ModelRow {
  modelId: string;
  name: string;
  enabled: boolean;
  alias?: string;
  tier?: string;
}

interface FallbackChain {
  name: string;
  models: string[];
}

interface ProviderDetailProps {
  provider: string;
  name: string;
  configured: boolean;
  onSave: (value: string) => void;
  onTest: (provider: string) => Promise<{ valid: boolean; error?: string }>;
  onDiscover?: (url: string) => void;
  onModels?: (provider: string) => Promise<Array<{ modelId: string; name: string; tier?: string }>>;
  discoveredModels?: Array<{ modelId: string; name: string; tier: string }>;
}

export function ProviderDetail({
  provider,
  name,
  configured,
  onSave,
  onTest,
  onDiscover,
  onModels,
  discoveredModels,
}: ProviderDetailProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);

  const [models, setModels] = useState<ModelRow[]>([]);
  const [fallbackChains, setFallbackChains] = useState<FallbackChain[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Fetch models when provider is configured
  const fetchModels = useCallback(async () => {
    if (!configured || !onModels) return;
    setModelsLoading(true);
    try {
      const result = await onModels(provider);
      setModels(
        result.map((m) => ({
          modelId: m.modelId,
          name: m.name,
          enabled: true,
          tier: m.tier ?? "standard",
        })),
      );
    } catch {
      // Models remain empty on error
    } finally {
      setModelsLoading(false);
    }
  }, [configured, onModels, provider]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Merge discovered Ollama models into model table
  useEffect(() => {
    if (discoveredModels && discoveredModels.length > 0) {
      setModels(discoveredModels.map((m) => ({
        modelId: m.modelId,
        name: m.name,
        enabled: true,
        tier: m.tier,
      })));
    }
  }, [discoveredModels]);

  const handleToggle = (modelId: string, enabled: boolean) => {
    setModels((prev) =>
      prev.map((m) => (m.modelId === modelId ? { ...m, enabled } : m)),
    );
  };

  const handleAlias = (modelId: string, alias: string) => {
    setModels((prev) =>
      prev.map((m) => (m.modelId === modelId ? { ...m, alias } : m)),
    );
  };

  const handleTier = (modelId: string, tier: string) => {
    setModels((prev) =>
      prev.map((m) => (m.modelId === modelId ? { ...m, tier } : m)),
    );
  };

  const handleAddModel = (modelId: string) => {
    setModels((prev) => [
      ...prev,
      { modelId, name: modelId, enabled: true, tier: "standard" },
    ]);
  };

  // Ollama uses a URL field instead of API key
  const isOllama = provider === "ollama";
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(provider);
      setTestResult(result);
    } catch {
      setTestResult({ valid: false, error: "Test request failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (isOllama) {
      onSave(ollamaUrl);
    } else {
      onSave(apiKey);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">{name} Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* API Key or URL input */}
        {isOllama ? (
          <div className="space-y-2">
            <label
              htmlFor="ollama-url"
              className="text-sm font-medium text-foreground"
            >
              Ollama URL
            </label>
            <div className="flex gap-2">
              <input
                id="ollama-url"
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                variant="outline"
                onClick={() => onDiscover?.(ollamaUrl)}
              >
                <Search className="size-4" />
                Discover Models
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Point to your local Ollama instance to discover available models.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="api-key"
              className="text-sm font-medium text-foreground"
            >
              API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    configured
                      ? "Key is set (enter new value to replace)"
                      : "Enter your API key"
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing || (!apiKey && !configured)}
              >
                <FlaskConical className="size-4" />
                {testing ? "Testing..." : "Test Key"}
              </Button>
            </div>
            {configured && !apiKey && (
              <p className="text-xs text-muted-foreground">
                A key is already configured. Enter a new value to replace it.
              </p>
            )}
          </div>
        )}

        {/* Test result feedback */}
        {testResult && (
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              testResult.valid
                ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-400"
                : "border-destructive/30 bg-destructive/10 text-red-400",
            )}
          >
            {testResult.valid
              ? "Key is valid and working."
              : `Test failed: ${testResult.error ?? "Unknown error"}`}
          </div>
        )}

        {/* Models */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Models</h3>
          {!configured ? (
            <div className="rounded-md border border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
              Models will appear here after configuration.
            </div>
          ) : modelsLoading ? (
            <div className="rounded-md border border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
              Loading models...
            </div>
          ) : models.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
              No models found. Add a custom model below.
            </div>
          ) : null}
          {configured && (
            <ModelTable
              models={models}
              onToggle={handleToggle}
              onAlias={handleAlias}
              onTier={handleTier}
              onAddModel={handleAddModel}
            />
          )}
        </div>

        {/* Fallback Chains */}
        {configured && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              Fallback Chains
            </h3>
            <p className="text-xs text-muted-foreground">
              Define ordered lists of models to try when the primary model is
              unavailable.
            </p>
            <FallbackChainEditor
              chains={fallbackChains}
              onChange={setFallbackChains}
            />
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!isOllama && !apiKey && !configured}
          >
            <Save className="size-4" />
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
