import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useWebSocket, type WebSocketStatus } from './useWebSocket';
import {
  createChatSend,
  createToolApprovalResponse,
  type ChatMessage,
  type ServerMessage,
  type SessionListResponse,
} from '@/lib/gateway-client';

export type { SessionListResponse };

interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

interface SessionSummary {
  sessionId: string;
  sessionKey: string;
  model: string;
  createdAt: string;
  messageCount: number;
}

interface UseChatParams {
  port: number | null;
  agentId: string | null;
}

interface UseChatReturn {
  messages: ChatMessage[];
  streamingText: string;
  streamingReasoning: string;
  isStreaming: boolean;
  currentModel: string | null;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
  cost: { totalCost: number } | null;
  todos: TodoItem[];
  sessions: SessionSummary[];
  sendMessage: (content: string) => void;
  approveToolCall: (toolCallId: string, approved: boolean, sessionApprove?: boolean) => void;
  clearMessages: () => void;
  send: (data: string) => void;
  wsStatus: WebSocketStatus;
}

/**
 * Chat state management hook.
 *
 * Manages the full chat lifecycle: user messages, streaming delta accumulation,
 * tool call tracking, tool approval flow, and session management. Connects to
 * gateway via useWebSocket.
 */
export function useChat({ port, agentId }: UseChatParams): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [_streamingRequestId, setStreamingRequestId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [usage, setUsage] = useState<UseChatReturn['usage']>(null);
  const [cost, setCost] = useState<UseChatReturn['cost']>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  // Ref for accumulating streaming text to avoid stale closure issues
  const streamingTextRef = useRef('');
  const streamingReasoningRef = useRef('');
  const pendingSourcesRef = useRef<Array<{ url: string; title?: string }>>([]);

  const setSessionId = useAppStore((s) => s.setSessionId);

  // Construct WS URL when port is available
  const wsUrl = port ? `ws://127.0.0.1:${port}/gateway` : '';

  const handleMessage = useCallback(
    (data: string) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(data) as ServerMessage;
      } catch {
        return; // Ignore malformed messages
      }

      switch (msg.type) {
        case 'chat.stream.start': {
          setIsStreaming(true);
          setStreamingText('');
          streamingTextRef.current = '';
          setStreamingReasoning('');
          streamingReasoningRef.current = '';
          pendingSourcesRef.current = [];
          setTodos([]);
          setStreamingRequestId(msg.requestId);
          setCurrentModel(msg.model);
          // Save sessionId to app store
          setSessionId(msg.sessionId);
          break;
        }

        case 'chat.stream.delta': {
          streamingTextRef.current += msg.delta;
          setStreamingText(streamingTextRef.current);
          break;
        }

        case 'chat.stream.reasoning': {
          streamingReasoningRef.current += msg.delta;
          setStreamingReasoning(streamingReasoningRef.current);
          break;
        }

        case 'chat.stream.source': {
          pendingSourcesRef.current.push(msg.source);
          break;
        }

        case 'chat.stream.end': {
          // Promote accumulated content to completed messages
          const completedReasoning = streamingReasoningRef.current;
          const completedText = streamingTextRef.current;
          const collectedSources = pendingSourcesRef.current;
          const now = Date.now();

          setMessages((prev) => {
            const next = [...prev];
            // Add reasoning message before text (appears above response)
            if (completedReasoning) {
              next.push({
                type: 'reasoning',
                id: crypto.randomUUID(),
                content: completedReasoning,
                timestamp: now,
              });
            }
            // Add assistant text message
            if (completedText) {
              next.push({
                type: 'text',
                id: crypto.randomUUID(),
                role: 'assistant',
                content: completedText,
                timestamp: now,
                model: currentModel ?? undefined,
              });
            }
            // Add sources message after text
            if (collectedSources.length > 0) {
              next.push({
                type: 'sources',
                id: crypto.randomUUID(),
                sources: [...collectedSources],
                timestamp: now,
              });
            }
            return next;
          });

          // Clear streaming state
          setStreamingText('');
          streamingTextRef.current = '';
          setStreamingReasoning('');
          streamingReasoningRef.current = '';
          pendingSourcesRef.current = [];
          setStreamingRequestId(null);
          setIsStreaming(false);
          // Save usage and cost
          setUsage(msg.usage);
          setCost({ totalCost: msg.cost.totalCost });
          break;
        }

        case 'session.created': {
          setSessionId(msg.sessionId);
          break;
        }

        case 'session.list': {
          setSessions(msg.sessions);
          break;
        }

        case 'tool.call': {
          setMessages((prev) => [
            ...prev,
            {
              type: 'tool_call',
              id: crypto.randomUUID(),
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
              args: msg.args,
              status: 'running',
            },
          ]);
          break;
        }

        case 'tool.result': {
          setMessages((prev) =>
            prev.map((m) =>
              m.type === 'tool_call' && m.toolCallId === msg.toolCallId
                ? { ...m, result: msg.result, status: 'completed' as const }
                : m,
            ),
          );
          break;
        }

        case 'tool.error': {
          setMessages((prev) =>
            prev.map((m) =>
              m.type === 'tool_call' && m.toolCallId === msg.toolCallId
                ? { ...m, error: msg.error, status: 'error' as const }
                : m,
            ),
          );
          break;
        }

        case 'tool.approval.request': {
          setMessages((prev) => [
            ...prev,
            {
              type: 'tool_approval',
              id: crypto.randomUUID(),
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
              args: msg.args,
              risk: msg.risk,
              status: 'pending',
            },
          ]);
          break;
        }

        case 'todo.update': {
          setTodos(msg.todos);
          break;
        }

        case 'error': {
          setTodos([]);
          setMessages((prev) => [
            ...prev,
            {
              type: 'text',
              id: crypto.randomUUID(),
              role: 'system',
              content: `Error${msg.code ? ` [${msg.code}]` : ''}: ${msg.message}`,
              timestamp: Date.now(),
            },
          ]);
          break;
        }

        default:
          // Other server message types not handled in chat view
          break;
      }
    },
    [currentModel, setSessionId],
  );

  const { status: wsStatus, send } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    enabled: !!port,
  });

  const sendMessage = useCallback(
    (content: string) => {
      // Append user message to messages array
      setMessages((prev) => [
        ...prev,
        {
          type: 'text',
          id: crypto.randomUUID(),
          role: 'user',
          content,
          timestamp: Date.now(),
        },
      ]);

      // Get sessionId from app store
      const sessionId = useAppStore.getState().sessionId ?? undefined;

      // Send protocol message via WebSocket
      const msg = createChatSend(content, {
        sessionId,
        agentId: agentId ?? undefined,
      });
      send(JSON.stringify(msg));
    },
    [agentId, send],
  );

  const approveToolCall = useCallback(
    (toolCallId: string, approved: boolean, sessionApprove?: boolean) => {
      // Send approval response via WebSocket
      const msg = createToolApprovalResponse(toolCallId, approved, sessionApprove);
      send(JSON.stringify(msg));

      // Update tool_approval message status
      setMessages((prev) =>
        prev.map((m) =>
          m.type === 'tool_approval' && m.toolCallId === toolCallId
            ? { ...m, status: (approved ? 'approved' : 'denied') as 'approved' | 'denied' }
            : m,
        ),
      );
    },
    [send],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingText('');
    streamingTextRef.current = '';
    setStreamingReasoning('');
    streamingReasoningRef.current = '';
    pendingSourcesRef.current = [];
    setTodos([]);
    setStreamingRequestId(null);
    setIsStreaming(false);
    setCurrentModel(null);
    setUsage(null);
    setCost(null);
  }, []);

  return {
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
    send,
    wsStatus,
  };
}
