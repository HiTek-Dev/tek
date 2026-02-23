import { useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

interface FallbackChain {
  name: string;
  models: string[];
}

interface FallbackChainEditorProps {
  chains: FallbackChain[];
  onChange: (chains: FallbackChain[]) => void;
}

export function FallbackChainEditor({
  chains,
  onChange,
}: FallbackChainEditorProps) {
  const [newChainName, setNewChainName] = useState("");

  const addChain = () => {
    const trimmed = newChainName.trim();
    if (!trimmed) return;
    onChange([...chains, { name: trimmed, models: [] }]);
    setNewChainName("");
  };

  const removeChain = (index: number) => {
    const next = chains.filter((_, i) => i !== index);
    onChange(next);
  };

  const moveChain = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chains.length) return;
    const next = [...chains];
    const a = next[index];
    const b = next[targetIndex];
    if (a && b) {
      next[index] = b;
      next[targetIndex] = a;
    }
    onChange(next);
  };

  const updateChainName = (index: number, name: string) => {
    const next = chains.map((c, i) => (i === index ? { ...c, name } : c));
    onChange(next);
  };

  const addModelToChain = (chainIndex: number, modelId: string) => {
    const trimmed = modelId.trim();
    if (!trimmed) return;
    const next = chains.map((c, i) =>
      i === chainIndex ? { ...c, models: [...c.models, trimmed] } : c,
    );
    onChange(next);
  };

  const removeModelFromChain = (
    chainIndex: number,
    modelIndex: number,
  ) => {
    const next = chains.map((c, i) =>
      i === chainIndex
        ? { ...c, models: c.models.filter((_, mi) => mi !== modelIndex) }
        : c,
    );
    onChange(next);
  };

  const moveModel = (
    chainIndex: number,
    modelIndex: number,
    direction: "up" | "down",
  ) => {
    const targetIndex = direction === "up" ? modelIndex - 1 : modelIndex + 1;
    const chain = chains[chainIndex];
    if (!chain || targetIndex < 0 || targetIndex >= chain.models.length) return;
    const models = [...chain.models];
    const ma = models[modelIndex];
    const mb = models[targetIndex];
    if (ma !== undefined && mb !== undefined) {
      models[modelIndex] = mb;
      models[targetIndex] = ma;
    }
    const next = chains.map((c, i) =>
      i === chainIndex ? { ...c, models } : c,
    );
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {chains.map((chain, chainIndex) => (
        <Card key={chainIndex}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <GripVertical className="size-4 text-muted-foreground" />
              <input
                type="text"
                value={chain.name}
                onChange={(e) => updateChainName(chainIndex, e.target.value)}
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => moveChain(chainIndex, "up")}
                  disabled={chainIndex === 0}
                  aria-label="Move chain up"
                >
                  <ArrowUp className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => moveChain(chainIndex, "down")}
                  disabled={chainIndex === chains.length - 1}
                  aria-label="Move chain down"
                >
                  <ArrowDown className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeChain(chainIndex)}
                  aria-label="Remove chain"
                  className="text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {chain.models.length === 0 && (
              <p className="text-xs text-muted-foreground py-1">
                No models in this chain. Add one below.
              </p>
            )}
            <ol className="space-y-1">
              {chain.models.map((model, modelIndex) => (
                <li
                  key={modelIndex}
                  className="flex items-center gap-2 rounded border border-border bg-muted/30 px-3 py-1.5 text-sm"
                >
                  <span className="text-xs font-mono text-muted-foreground w-5">
                    {modelIndex + 1}.
                  </span>
                  <span className="flex-1 font-mono text-xs text-foreground">
                    {model}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        moveModel(chainIndex, modelIndex, "up")
                      }
                      disabled={modelIndex === 0}
                      aria-label="Move model up"
                    >
                      <ArrowUp className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        moveModel(chainIndex, modelIndex, "down")
                      }
                      disabled={modelIndex === chain.models.length - 1}
                      aria-label="Move model down"
                    >
                      <ArrowDown className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        removeModelFromChain(chainIndex, modelIndex)
                      }
                      aria-label="Remove model"
                      className="text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
            <AddModelInput
              onAdd={(modelId) => addModelToChain(chainIndex, modelId)}
            />
          </CardContent>
        </Card>
      ))}

      {/* Add new chain */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newChainName}
          onChange={(e) => setNewChainName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addChain();
          }}
          placeholder="New chain name..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button variant="outline" onClick={addChain} disabled={!newChainName.trim()}>
          <Plus className="size-4" />
          Add Chain
        </Button>
      </div>
    </div>
  );
}

/** Small inline component for adding a model to a chain. */
function AddModelInput({ onAdd }: { onAdd: (modelId: string) => void }) {
  const [value, setValue] = useState("");

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
  };

  return (
    <div className="flex gap-2 pt-1">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
        }}
        placeholder="Add model ID..."
        className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button
        variant="ghost"
        size="xs"
        onClick={handleAdd}
        disabled={!value.trim()}
      >
        <Plus className="size-3" />
        Add
      </Button>
    </div>
  );
}
