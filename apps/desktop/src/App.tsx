import { lazy, Suspense, useEffect } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useAppStore } from "@/stores/app-store";
import { useConfig } from "@/hooks/useConfig";
import { useGatewayRpc } from "@/hooks/useGatewayRpc";
import {
  createVaultKeysList,
  type VaultKeysListResult,
} from "@/lib/gateway-client";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { LandingView } from "@/views/LandingView";
import { ChatView } from "@/views/ChatView";

const ProvidersView = lazy(() =>
  import("@/views/ProvidersView").then((m) => ({ default: m.ProvidersView })),
);
const ServicesView = lazy(() =>
  import("@/views/ServicesView").then((m) => ({ default: m.ServicesView })),
);
const AgentsView = lazy(() =>
  import("@/views/AgentsView").then((m) => ({ default: m.AgentsView })),
);
const AgentDetailView = lazy(() =>
  import("@/views/AgentDetailView").then((m) => ({ default: m.AgentDetailView })),
);
const GatewayView = lazy(() =>
  import("@/views/GatewayView").then((m) => ({ default: m.GatewayView })),
);
const OnboardingView = lazy(() =>
  import("@/views/OnboardingView").then((m) => ({ default: m.OnboardingView })),
);

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-8">
      <h2 className="text-xl font-semibold text-destructive-foreground">
        Something went wrong
      </h2>
      <pre className="max-w-lg overflow-auto rounded-md bg-muted p-4 text-sm text-muted-foreground">
        {message}
      </pre>
      <Button variant="outline" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
}

function LazyFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="text-sm text-muted-foreground">Loading...</span>
    </div>
  );
}

function ViewRouter() {
  const currentView = useAppStore((s) => s.currentView);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const { config } = useConfig();
  const { request, connected } = useGatewayRpc();
  const setHasConfiguredProvider = useAppStore((s) => s.setHasConfiguredProvider);

  // First-run detection: force onboarding if not complete
  useEffect(() => {
    if (config && !config.onboardingComplete && currentView !== "onboarding" && currentView !== "landing") {
      setCurrentView("onboarding");
    }
  }, [config, currentView, setCurrentView]);

  // Startup provider check: redirect to providers page if none configured
  useEffect(() => {
    if (!connected) return;

    async function checkProviders() {
      try {
        const result = await request<VaultKeysListResult>(createVaultKeysList());
        if (result.type === "vault.keys.list.result" && result.providers) {
          // LLM providers only (exclude service keys like telegram, brave, tavily)
          const SERVICE_KEYS = ["telegram", "brave", "tavily"];
          const hasProvider = result.providers.some(
            (p) => p.configured && !SERVICE_KEYS.includes(p.provider),
          );
          setHasConfiguredProvider(hasProvider);

          // If no providers and not already on providers/onboarding/landing, redirect
          if (!hasProvider && !["providers", "onboarding", "landing"].includes(currentView)) {
            setCurrentView("providers");
          }
        }
      } catch {
        // Gateway may not support this message -- fail open
      }
    }

    checkProviders();
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  switch (currentView) {
    case "landing":
      return <LandingView />;
    case "chat":
      return <ChatView />;
    case "providers":
      return (
        <Suspense fallback={<LazyFallback />}>
          <ProvidersView />
        </Suspense>
      );
    case "services":
      return (
        <Suspense fallback={<LazyFallback />}>
          <ServicesView />
        </Suspense>
      );
    case "agents":
      return (
        <Suspense fallback={<LazyFallback />}>
          <AgentsView />
        </Suspense>
      );
    case "agent-detail":
      return (
        <Suspense fallback={<LazyFallback />}>
          <AgentDetailView />
        </Suspense>
      );
    case "gateway":
      return (
        <Suspense fallback={<LazyFallback />}>
          <GatewayView />
        </Suspense>
      );
    case "onboarding":
      return (
        <Suspense fallback={<LazyFallback />}>
          <OnboardingView />
        </Suspense>
      );
    default:
      return <LandingView />;
  }
}

export function App() {
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const setSessionId = useAppStore((s) => s.setSessionId);

  // Cmd+N (Mac) / Ctrl+N: new chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        // Clear session, switch to chat view
        setSessionId(null);
        setCurrentView("chat");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSessionId, setCurrentView]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Layout>
        <ViewRouter />
      </Layout>
    </ErrorBoundary>
  );
}
