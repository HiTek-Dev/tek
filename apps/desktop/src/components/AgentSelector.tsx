import { useEffect } from "react";
import { Bot, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Agent {
  id: string;
  name?: string;
  description?: string;
}

interface AgentSelectorProps {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AgentSelector({
  agents,
  selectedId,
  onSelect,
}: AgentSelectorProps) {
  // Auto-select if only one agent
  useEffect(() => {
    const first = agents[0];
    if (agents.length === 1 && first && selectedId !== first.id) {
      onSelect(first.id);
    }
  }, [agents, selectedId, onSelect]);

  const selectedAgent = agents.find((a) => a.id === selectedId);
  const displayName = selectedAgent?.name ?? selectedAgent?.id ?? "Select agent";

  // Single agent -- just show the name, no dropdown
  if (agents.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Bot className="size-4 text-muted-foreground" />
        <span>{displayName}</span>
      </div>
    );
  }

  // Multiple agents -- show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Bot className="size-4" />
          <span>{displayName}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {agents.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className={
              agent.id === selectedId ? "bg-accent" : undefined
            }
          >
            <div className="flex flex-col">
              <span className="text-sm">{agent.name ?? agent.id}</span>
              {agent.description && (
                <span className="text-xs text-muted-foreground">
                  {agent.description}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
