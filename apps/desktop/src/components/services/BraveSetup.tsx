import { useState, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useGatewayRpc } from "@/hooks/useGatewayRpc";
import {
  createVaultKeysSet,
  createVaultKeysTest,
} from "@/lib/gateway-client";
import type {
  VaultKeysSetResult,
  VaultKeysTestResult,
} from "@/lib/gateway-client";

type StatusFeedback = {
  kind: "success" | "error" | "idle";
  message: string;
};

export function BraveSetup() {
  const { request, connected } = useGatewayRpc();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<StatusFeedback>({
    kind: "idle",
    message: "",
  });
  const [testStatus, setTestStatus] = useState<StatusFeedback>({
    kind: "idle",
    message: "",
  });

  // ── Save key ──────────────────────────────────────────────────────
  const handleSaveKey = useCallback(async () => {
    if (!apiKey.trim() || !connected) return;
    setSaving(true);
    setSaveStatus({ kind: "idle", message: "" });
    try {
      const res = await request<VaultKeysSetResult>(
        createVaultKeysSet("brave", apiKey.trim()),
      );
      if (res.success) {
        setSaveStatus({ kind: "success", message: "API key saved" });
        setApiKey("");
      } else {
        setSaveStatus({
          kind: "error",
          message: res.error ?? "Failed to save key",
        });
      }
    } catch (err) {
      setSaveStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSaving(false);
    }
  }, [apiKey, connected, request]);

  // ── Test key ──────────────────────────────────────────────────────
  const handleTestKey = useCallback(async () => {
    if (!connected) return;
    setTesting(true);
    setTestStatus({ kind: "idle", message: "" });
    try {
      const res = await request<VaultKeysTestResult>(
        createVaultKeysTest("brave"),
      );
      if (res.valid) {
        setTestStatus({ kind: "success", message: "API key is valid" });
      } else {
        setTestStatus({
          kind: "error",
          message: res.error ?? "API key is invalid",
        });
      }
    } catch (err) {
      setTestStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  }, [connected, request]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Brave Search API Key</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Enter your Brave Search API key to enable web search capabilities.
          You can obtain a key from{" "}
          <a
            href="https://brave.com/search/api/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            brave.com/search/api
          </a>
          .
        </p>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter Brave Search API key..."
              className="h-9 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <Button
            size="sm"
            onClick={handleSaveKey}
            disabled={!apiKey.trim() || saving || !connected}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save Key
          </Button>
        </div>

        {saveStatus.kind !== "idle" && (
          <div
            className={`flex items-center gap-2 text-sm ${
              saveStatus.kind === "success"
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {saveStatus.kind === "success" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <XCircle className="size-4" />
            )}
            {saveStatus.message}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestKey}
            disabled={testing || !connected}
          >
            {testing && <Loader2 className="size-4 animate-spin" />}
            Test Key
          </Button>
          {testStatus.kind !== "idle" && (
            <span
              className={`text-sm ${
                testStatus.kind === "success"
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {testStatus.message}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
