import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { LandingView } from "@/views/LandingView";

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

function ChatViewPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Chat coming soon
    </div>
  );
}

export function App() {
  const currentView = useAppStore((s) => s.currentView);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Layout>
        {currentView === "landing" ? (
          <LandingView />
        ) : (
          <ChatViewPlaceholder />
        )}
      </Layout>
    </ErrorBoundary>
  );
}
