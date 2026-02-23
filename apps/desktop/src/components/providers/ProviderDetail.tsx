import { useState } from "react";
import { Eye, EyeOff, FlaskConical, Save, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProviderDetailProps {
  provider: string;
  name: string;
  configured: boolean;
  onSave: (value: string) => void;
  onTest: (provider: string) => Promise<{ valid: boolean; error?: string }>;
  onDiscover?: (url: string) => void;
}

export function ProviderDetail({
  provider,
  name,
  configured,
  onSave,
  onTest,
  onDiscover,
}: ProviderDetailProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);

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

        {/* Model table placeholder */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Models</h3>
          <div className="rounded-md border border-border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
            Models will appear here after configuration.
          </div>
        </div>

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
