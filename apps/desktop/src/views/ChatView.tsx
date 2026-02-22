import { useCallback, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { useChat } from "@/hooks/useChat";
import { useConfig } from "@/hooks/useConfig";
import { MessageList } from "@/components/MessageList";
import { ChatInput } from "@/components/ChatInput";
import { AgentSelector, type Agent } from "@/components/AgentSelector";
import { ToolApprovalModal } from "@/components/ToolApprovalModal";
import { SessionList } from "@/components/SessionList";
import { TodoPanel } from "@/components/TodoPanel";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";
import { createSessionList } from "@/lib/gateway-client";

interface ChatViewProps {
  sidebarOpen: boolean;
}

export function ChatView({ sidebarOpen }: ChatViewProps) {
  const port = useAppStore((s) => s.gateway.port);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const setSelectedAgentId = useAppStore((s) => s.setSelectedAgentId);
  const sessionId = useAppStore((s) => s.sessionId);
  const setSessionId = useAppStore((s) => s.setSessionId);

  const { config } = useConfig();

  const {
    messages,
    streamingText,
    streamingReasoning,
    isStreaming,
    currentModel,
    usage,
    cost,
    todos,
    sessions,
    sendMessage,
    approveToolCall,
    clearMessages,
    wsStatus,
    send,
  } = useChat({ port, agentId: selectedAgentId });

  // Derive agent list from config
  const agents: Agent[] = config?.agents?.list ?? [];

  // Agent auto-selection logic
  useEffect(() => {
    if (selectedAgentId) return; // Already selected
    const first = agents[0];
    if (agents.length === 1 && first) {
      setSelectedAgentId(first.id);
    } else if (agents.length > 1 && config?.agents?.defaultAgentId) {
      setSelectedAgentId(config.agents.defaultAgentId);
    }
  }, [agents, selectedAgentId, setSelectedAgentId, config]);

  // Fetch session list when connected
  useEffect(() => {
    if (wsStatus !== "connected" || !send) return;

    // Request session list from gateway
    const msg = createSessionList();
    send(JSON.stringify(msg));
  }, [wsStatus, send]);

  // Find the first pending tool approval to show in the modal
  const pendingApproval = messages.find(
    (m) => m.type === "tool_approval" && m.status === "pending",
  );

  const handleApprove = useCallback(
    (toolCallId: string, sessionApprove: boolean) => {
      approveToolCall(toolCallId, true, sessionApprove);
    },
    [approveToolCall],
  );

  const handleDeny = useCallback(
    (toolCallId: string) => {
      approveToolCall(toolCallId, false);
    },
    [approveToolCall],
  );

  const handleSelectSession = useCallback(
    (selectedSessionId: string) => {
      if (selectedSessionId === "") {
        // New chat: clear session and messages
        setSessionId(null);
        clearMessages();
      } else {
        // Switch to existing session
        setSessionId(selectedSessionId);
        clearMessages();
      }
    },
    [setSessionId, clearMessages],
  );

  const wsConnected = wsStatus === "connected";

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      {sidebarOpen && (
        <div className="w-[280px] shrink-0 border-r">
          <SessionList
            sessions={sessions}
            currentSessionId={sessionId}
            onSelectSession={handleSelectSession}
          />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: agent selector + status info */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
          <AgentSelector
            agents={agents}
            selectedId={selectedAgentId}
            onSelect={setSelectedAgentId}
          />

          <div className="flex items-center gap-2">
            {/* Model / token info */}
            {currentModel && (
              <Badge variant="outline" className="text-[10px]">
                {currentModel}
              </Badge>
            )}
            {usage && (
              <span className="text-[10px] text-muted-foreground">
                {usage.totalTokens.toLocaleString()} tokens
              </span>
            )}

            {/* WebSocket connection status */}
            {wsConnected ? (
              <Wifi className="size-3.5 text-green-500" />
            ) : (
              <WifiOff className="size-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Message list (flex-1, scrollable) */}
        <div className="flex-1 overflow-hidden">
          <MessageList
            messages={messages}
            streamingText={streamingText}
            streamingReasoning={streamingReasoning}
            isStreaming={isStreaming}
            model={currentModel}
          />
        </div>

        {/* Usage/cost footer */}
        {(usage || cost) && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t px-4 py-1">
            {usage && (
              <span className="text-[10px] text-muted-foreground">
                {usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out
              </span>
            )}
            {cost && cost.totalCost > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ${cost.totalCost.toFixed(4)}
              </span>
            )}
          </div>
        )}

        {/* Todo progress panel */}
        <TodoPanel todos={todos} />

        {/* Chat input (fixed at bottom) */}
        <ChatInput onSend={sendMessage} disabled={isStreaming} />
      </div>

      {/* Tool Approval Modal */}
      {pendingApproval && pendingApproval.type === "tool_approval" && (
        <ToolApprovalModal
          open
          toolName={pendingApproval.toolName}
          toolCallId={pendingApproval.toolCallId}
          args={pendingApproval.args}
          risk={pendingApproval.risk}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      )}
    </div>
  );
}
