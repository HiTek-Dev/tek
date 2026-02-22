import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-8">
      <h2 className="text-xl font-semibold text-destructive-foreground">
        Something went wrong
      </h2>
      <pre className="max-w-lg overflow-auto rounded-md bg-muted p-4 text-sm text-muted-foreground">
        {error.message}
      </pre>
      <Button variant="outline" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
}

export function App() {
  const currentView = useAppStore((s) => s.currentView);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {currentView === "landing" ? (
        <div className="flex items-center justify-center h-screen text-muted-foreground">
          Landing View (placeholder)
        </div>
      ) : (
        <div className="flex items-center justify-center h-screen text-muted-foreground">
          Chat View (placeholder)
        </div>
      )}
    </ErrorBoundary>
  );
}
