import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Plus, X } from "lucide-react";
import { useGatewayRpc } from "@/hooks/useGatewayRpc";
import {
  createConfigGet,
  createAgentCreate,
  type ConfigGetResult,
  type AgentCreateResult,
} from "@/lib/gateway-client";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AgentConfig {
  id: string;
  name?: string;
  model?: string;
  description?: string;
  personalityPreset?: string;
  purpose?: string;
}

export function AgentsView() {
  const { request, connected } = useGatewayRpc();
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const setAgentDetailId = useAppStore((s) => s.setAgentDetailId);

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newModel, setNewModel] = useState("claude-sonnet-4-20250514");
  const [newPreset, setNewPreset] = useState("balanced");
  const [newDescription, setNewDescription] = useState("");

  const fetchAgents = useCallback(async () => {
    if (!connected) return;

    setLoading(true);
    setError(null);

    try {
      const res = await request<ConfigGetResult>(createConfigGet());
      const config = res.config;

      // Extract agents from config -- config.agents is an object keyed by agent ID
      const agentsMap =
        (config?.agents as Record<string, Omit<AgentConfig, "id">>) ?? {};
      const agentList: AgentConfig[] = Object.entries(agentsMap).map(
        ([id, cfg]) => ({
          id,
          ...cfg,
        }),
      );
      setAgents(agentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreate = async () => {
    if (!newName.trim() || !connected) return;

    setCreating(true);
    setError(null);

    const agentId = newName.trim().toLowerCase().replace(/\s+/g, "-");

    try {
      const res = await request<AgentCreateResult>(
        createAgentCreate({
          id: agentId,
          name: newName.trim(),
          model: newModel,
          description: newDescription.trim() || undefined,
          personalityPreset: newPreset,
        }),
      );

      if (res.success) {
        // Reset form and refresh
        setNewName("");
        setNewModel("claude-sonnet-4-20250514");
        setNewPreset("balanced");
        setNewDescription("");
        setShowCreateForm(false);
        await fetchAgents();
      } else if (res.error) {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  const handleCardClick = (agentId: string) => {
    setAgentDetailId(agentId);
    setCurrentView("agent-detail");
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading agents...
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage your AI agents. Each agent has its own identity,
            model configuration, and personality.
          </p>
        </div>

        <Button
          variant={showCreateForm ? "ghost" : "default"}
          size="sm"
          onClick={() => setShowCreateForm((p) => !p)}
        >
          {showCreateForm ? (
            <>
              <X className="size-4" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="size-4" />
              Create Agent
            </>
          )}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">New Agent</CardTitle>
            <CardDescription>
              Configure the basics for your new agent. You can customize identity
              files and model routing after creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Agent"
                  className={cn(
                    "h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none",
                    "placeholder:text-muted-foreground",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "dark:bg-input/30",
                  )}
                />
              </div>

              {/* Model */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Model
                </label>
                <select
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className={cn(
                    "h-9 cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "dark:bg-input/30",
                  )}
                >
                  <option value="claude-sonnet-4-20250514" className="bg-card">
                    Claude Sonnet 4
                  </option>
                  <option value="claude-opus-4-20250514" className="bg-card">
                    Claude Opus 4
                  </option>
                  <option value="gpt-4o" className="bg-card">
                    GPT-4o
                  </option>
                  <option value="gpt-4o-mini" className="bg-card">
                    GPT-4o Mini
                  </option>
                  <option value="gemini-2.5-pro" className="bg-card">
                    Gemini 2.5 Pro
                  </option>
                  <option value="gemini-2.5-flash" className="bg-card">
                    Gemini 2.5 Flash
                  </option>
                  <option value="deepseek-r1" className="bg-card">
                    DeepSeek R1
                  </option>
                  <option value="llama-3.3-70b" className="bg-card">
                    Llama 3.3 70B
                  </option>
                </select>
              </div>

              {/* Personality preset */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Personality Preset
                </label>
                <select
                  value={newPreset}
                  onChange={(e) => setNewPreset(e.target.value)}
                  className={cn(
                    "h-9 cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "dark:bg-input/30",
                  )}
                >
                  <option value="balanced" className="bg-card">
                    Balanced
                  </option>
                  <option value="professional" className="bg-card">
                    Professional
                  </option>
                  <option value="creative" className="bg-card">
                    Creative
                  </option>
                  <option value="concise" className="bg-card">
                    Concise
                  </option>
                  <option value="friendly" className="bg-card">
                    Friendly
                  </option>
                  <option value="technical" className="bg-card">
                    Technical
                  </option>
                </select>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Description
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="A brief description of this agent"
                  className={cn(
                    "h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none",
                    "placeholder:text-muted-foreground",
                    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    "dark:bg-input/30",
                  )}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim() || creating || !connected}
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Create Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent grid */}
      {agents.length === 0 && !showCreateForm ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
          <Bot className="size-10 opacity-40" />
          <h2 className="text-lg font-semibold text-foreground">
            No agents yet
          </h2>
          <p className="text-sm">
            Create your first agent to get started.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="size-4" />
            Create Agent
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card
              key={agent.id}
              className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/30"
              onClick={() => handleCardClick(agent.id)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="size-4 text-primary" />
                  {agent.name || agent.id}
                </CardTitle>
                <CardDescription>
                  {agent.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Model</span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {formatModelName(agent.model)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Personality
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize text-foreground">
                      {agent.personalityPreset || "balanced"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function formatModelName(model?: string): string {
  if (!model) return "Default";
  // Shorten common model IDs for display
  const map: Record<string, string> = {
    "claude-sonnet-4-20250514": "Sonnet 4",
    "claude-opus-4-20250514": "Opus 4",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "deepseek-r1": "DeepSeek R1",
    "llama-3.3-70b": "Llama 3.3 70B",
  };
  return map[model] ?? model;
}
