import { useState, useCallback } from "react";
import {
  Sparkles,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useGatewayRpc } from "@/hooks/useGatewayRpc";
import {
  createVaultKeysSet,
  createVaultKeysTest,
  createProviderModelsList,
  createConfigUpdate,
  createAgentCreate,
} from "@/lib/gateway-client";
import type {
  VaultKeysTestResult,
  ProviderModelsListResult,
  ServerMessage,
} from "@/lib/gateway-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 5;

interface ProviderInfo {
  id: string;
  name: string;
  local?: boolean;
}

const PROVIDERS: ProviderInfo[] = [
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  { id: "google", name: "Google" },
  { id: "venice", name: "Venice" },
  { id: "ollama", name: "Ollama", local: true },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingView() {
  const { request } = useGatewayRpc();
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  // ── Step navigation ───────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── Step 2 – API Key ──────────────────────────────────────────────
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  // ── Step 3 – Model selection ──────────────────────────────────────
  const [models, setModels] = useState<
    Array<{ modelId: string; name: string; tier?: string }>
  >([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // ── Step 4 – Agent naming ─────────────────────────────────────────
  const [agentName, setAgentName] = useState("Tek");
  const [agentDescription, setAgentDescription] = useState("");

  // ── Step 5 – finishing ────────────────────────────────────────────
  const [finishing, setFinishing] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────

  const isOllama = selectedProvider === "ollama";

  const resetKeyState = useCallback(() => {
    setApiKey("");
    setOllamaUrl("http://localhost:11434");
    setShowKey(false);
    setKeyValid(null);
    setKeyError(null);
  }, []);

  const handleSelectProvider = useCallback(
    (id: string) => {
      if (id !== selectedProvider) {
        resetKeyState();
      }
      setSelectedProvider(id);
    },
    [selectedProvider, resetKeyState],
  );

  // Save key then verify it
  const handleVerifyKey = useCallback(async () => {
    if (!selectedProvider) return;
    setVerifying(true);
    setKeyValid(null);
    setKeyError(null);

    try {
      // For non-Ollama providers, store the key first
      if (!isOllama) {
        const setMsg = createVaultKeysSet(selectedProvider, apiKey);
        const setResult = await request<ServerMessage>(setMsg);
        if (
          setResult.type === "vault.keys.set.result" &&
          !setResult.success
        ) {
          setKeyError(setResult.error ?? "Failed to store key");
          setVerifying(false);
          return;
        }
      }

      // Test the key / connection
      const testMsg = createVaultKeysTest(selectedProvider);
      const testResult = await request<VaultKeysTestResult>(testMsg);

      if (testResult.type === "vault.keys.test.result") {
        setKeyValid(testResult.valid);
        if (!testResult.valid) {
          setKeyError(testResult.error ?? "Key is invalid");
        }
      } else {
        setKeyError("Unexpected response from gateway");
      }
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Verification failed");
      setKeyValid(false);
    } finally {
      setVerifying(false);
    }
  }, [selectedProvider, apiKey, isOllama, request]);

  // Fetch models for the verified provider
  const fetchModels = useCallback(async () => {
    if (!selectedProvider) return;
    setLoadingModels(true);
    setModelsError(null);
    setModels([]);
    setSelectedModel(null);

    try {
      const msg = createProviderModelsList(selectedProvider);
      const result = await request<ProviderModelsListResult>(msg);

      if (result.type === "provider.models.list.result") {
        setModels(result.models);
        const firstModel = result.models[0];
        if (firstModel) {
          setSelectedModel(firstModel.modelId);
        }
      } else {
        setModelsError("Unexpected response");
      }
    } catch (err) {
      setModelsError(
        err instanceof Error ? err.message : "Failed to fetch models",
      );
    } finally {
      setLoadingModels(false);
    }
  }, [selectedProvider, request]);

  // Finish onboarding
  const handleFinish = useCallback(async () => {
    setFinishing(true);
    try {
      // 1. Mark onboarding complete + save default model
      const configPatch: Record<string, unknown> = {
        onboardingComplete: true,
      };
      if (selectedModel) {
        configPatch.defaultModel = selectedModel;
      }
      await request<ServerMessage>(createConfigUpdate(configPatch));

      // 2. Create agent if named
      if (agentName.trim()) {
        await request<ServerMessage>(
          createAgentCreate({
            id: crypto.randomUUID(),
            name: agentName.trim(),
            model: selectedModel ?? undefined,
            description: agentDescription.trim() || undefined,
          }),
        );
      }

      // 3. Navigate to chat
      setCurrentView("chat");
    } catch {
      // Even if something fails, move on – we don't want to trap the user
      setCurrentView("chat");
    } finally {
      setFinishing(false);
    }
  }, [selectedModel, agentName, agentDescription, request, setCurrentView]);

  // ── Step transitions ──────────────────────────────────────────────

  const goNext = useCallback(() => {
    if (step === 2 && keyValid) {
      // Transitioning from key verified to model selection – fetch models
      fetchModels();
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, [step, keyValid, fetchModels]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  // Can the user proceed?
  const canProceed = (() => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return keyValid === true;
      case 3:
        return selectedModel !== null;
      case 4:
        return true; // name is optional (has default)
      case 5:
        return true;
      default:
        return false;
    }
  })();

  // ── Render helpers ────────────────────────────────────────────────

  const providerDisplayName =
    PROVIDERS.find((p) => p.id === selectedProvider)?.name ?? selectedProvider;

  // =====================================================================
  //  STEP CONTENT
  // =====================================================================

  const renderStep = () => {
    switch (step) {
      // ── Step 1: Welcome ───────────────────────────────────────────
      case 1:
        return (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                Welcome to Tek
              </h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Your personal AI assistant. Let&rsquo;s get you set up in a few
                quick steps.
              </p>
            </div>
            <Button size="lg" onClick={goNext}>
              Get Started
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>
        );

      // ── Step 2: Add First API Key ─────────────────────────────────
      case 2:
        return (
          <div className="flex w-full max-w-lg flex-col gap-6">
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-bold text-foreground">
                Add Your First API Key
              </h2>
              <p className="text-sm text-muted-foreground">
                Select a provider and enter your API key to get started.
              </p>
            </div>

            {/* Provider cards */}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {PROVIDERS.map((provider) => (
                <div
                  key={provider.id}
                  onClick={() => handleSelectProvider(provider.id)}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-accent/50",
                    selectedProvider === provider.id
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  <KeyRound
                    className={cn(
                      "size-5",
                      selectedProvider === provider.id
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  />
                  <span className="text-xs font-medium">{provider.name}</span>
                </div>
              ))}
            </div>

            {/* Key input area */}
            {selectedProvider && (
              <Card className="gap-4 p-4">
                {isOllama ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Ollama runs locally &mdash; no API key needed.
                    </p>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="ollama-url"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Ollama URL
                      </label>
                      <input
                        id="ollama-url"
                        type="text"
                        value={ollamaUrl}
                        onChange={(e) => setOllamaUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="api-key"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {providerDisplayName} API Key
                    </label>
                    <div className="relative">
                      <input
                        id="api-key"
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          setKeyValid(null);
                          setKeyError(null);
                        }}
                        placeholder="sk-..."
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 pr-9 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showKey ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Verify button + feedback */}
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    onClick={handleVerifyKey}
                    disabled={
                      verifying || (!isOllama && apiKey.trim().length === 0)
                    }
                  >
                    {verifying && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Verify Key
                  </Button>

                  {keyValid === true && (
                    <span className="flex items-center gap-1 text-sm text-green-500">
                      <CheckCircle2 className="size-4" />
                      Valid
                    </span>
                  )}
                  {keyValid === false && (
                    <span className="text-sm text-destructive">
                      {keyError ?? "Invalid key"}
                    </span>
                  )}
                </div>
              </Card>
            )}
          </div>
        );

      // ── Step 3: Select Default Model ──────────────────────────────
      case 3:
        return (
          <div className="flex w-full max-w-lg flex-col gap-6">
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-bold text-foreground">
                Select Default Model
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose the model you&rsquo;d like to use by default.
              </p>
            </div>

            {loadingModels && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {modelsError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-center">
                <p className="text-sm text-destructive">{modelsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={fetchModels}
                >
                  Retry
                </Button>
              </div>
            )}

            {!loadingModels && !modelsError && models.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No models found for this provider.
              </p>
            )}

            {!loadingModels && models.length > 0 && (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {models.map((model) => (
                  <div
                    key={model.modelId}
                    onClick={() => setSelectedModel(model.modelId)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50",
                      selectedModel === model.modelId
                        ? "border-primary bg-primary/5"
                        : "border-border",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selectedModel === model.modelId
                          ? "border-primary"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {selectedModel === model.modelId && (
                        <div className="size-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {model.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {model.modelId}
                      </p>
                    </div>
                    {model.tier && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {model.tier}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // ── Step 4: Name Your Agent ───────────────────────────────────
      case 4:
        return (
          <div className="flex w-full max-w-lg flex-col gap-6">
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-bold text-foreground">
                Name Your Agent
              </h2>
              <p className="text-sm text-muted-foreground">
                Give your assistant a name and optional description.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="agent-name"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Agent Name
                </label>
                <input
                  id="agent-name"
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Tek"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="agent-desc"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Description{" "}
                  <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <textarea
                  id="agent-desc"
                  value={agentDescription}
                  onChange={(e) => setAgentDescription(e.target.value)}
                  placeholder="A helpful coding assistant..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={goNext}
              className="self-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Skip, use defaults
            </button>
          </div>
        );

      // ── Step 5: Done ──────────────────────────────────────────────
      case 5:
        return (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="size-8 text-green-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                You&rsquo;re All Set!
              </h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Here&rsquo;s a summary of your configuration:
              </p>
            </div>

            <div className="w-full max-w-xs space-y-2 rounded-lg border border-border p-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-medium text-foreground">
                  {providerDisplayName}
                </span>
              </div>
              {selectedModel && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="max-w-[180px] truncate font-medium text-foreground">
                    {selectedModel}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent</span>
                <span className="font-medium text-foreground">
                  {agentName.trim() || "Tek"}
                </span>
              </div>
            </div>

            <Button size="lg" onClick={handleFinish} disabled={finishing}>
              {finishing && <Loader2 className="size-4 animate-spin" />}
              Start Chatting
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  // =====================================================================
  //  MAIN LAYOUT
  // =====================================================================

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      {/* Step content */}
      <div className="flex min-h-[400px] w-full max-w-xl flex-col items-center justify-center">
        {renderStep()}
      </div>

      {/* Navigation: back / stepper dots / next */}
      <div className="mt-8 flex w-full max-w-xl items-center justify-between">
        {/* Back button */}
        <div className="w-24">
          {step > 1 && (
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          )}
        </div>

        {/* Stepper dots */}
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={cn(
                "size-2 rounded-full transition-colors",
                s === step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {/* Next button – hidden on step 1 (has inline CTA) and step 5 (has inline CTA) */}
        <div className="w-24 text-right">
          {step > 1 && step < TOTAL_STEPS && (
            <Button size="sm" onClick={goNext} disabled={!canProceed}>
              Next
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
