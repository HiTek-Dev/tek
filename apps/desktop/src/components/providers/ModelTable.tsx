import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModelRow {
  modelId: string;
  name: string;
  enabled: boolean;
  alias?: string;
  tier?: string;
}

interface ModelTableProps {
  models: ModelRow[];
  onToggle: (modelId: string, enabled: boolean) => void;
  onAlias: (modelId: string, alias: string) => void;
  onTier: (modelId: string, tier: string) => void;
  onAddModel?: (modelId: string) => void;
}

const TIER_OPTIONS = ["high", "standard", "budget"] as const;

export function ModelTable({
  models,
  onToggle,
  onAlias,
  onTier,
  onAddModel,
}: ModelTableProps) {
  const [newModelId, setNewModelId] = useState("");

  const handleAddModel = () => {
    const trimmed = newModelId.trim();
    if (trimmed && onAddModel) {
      onAddModel(trimmed);
      setNewModelId("");
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="w-16 px-4 py-2 text-left font-medium text-muted-foreground">
              On
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Model ID
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Alias
            </th>
            <th className="w-32 px-4 py-2 text-left font-medium text-muted-foreground">
              Tier
            </th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => (
            <tr
              key={model.modelId}
              className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={model.enabled}
                  onChange={(e) => onToggle(model.modelId, e.target.checked)}
                  className="size-4 rounded border-border bg-background accent-primary"
                />
              </td>
              <td className="px-4 py-2 font-mono text-xs text-foreground">
                {model.name || model.modelId}
              </td>
              <td className="px-4 py-2">
                <input
                  type="text"
                  value={model.alias ?? ""}
                  onChange={(e) => onAlias(model.modelId, e.target.value)}
                  placeholder="--"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </td>
              <td className="px-4 py-2">
                <select
                  value={model.tier ?? "standard"}
                  onChange={(e) => onTier(model.modelId, e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {TIER_OPTIONS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}

          {/* Add custom model row */}
          <tr className="bg-muted/20">
            <td className="px-4 py-2" />
            <td className="px-4 py-2" colSpan={2}>
              <input
                type="text"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddModel();
                }}
                placeholder="Add custom model ID..."
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </td>
            <td className="px-4 py-2">
              <Button
                variant="ghost"
                size="xs"
                onClick={handleAddModel}
                disabled={!newModelId.trim()}
              >
                <Plus className="size-3" />
                Add
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
