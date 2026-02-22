// ── Client Message Types ────────────────────────────────────────────────
// Local types matching gateway protocol. Do NOT import from @tek/gateway
// (Node.js package -- won't work in Tauri webview).

export interface ChatSend {
  type: 'chat.send';
  id: string;
  content: string;
  sessionId?: string;
  model?: string;
  agentId?: string;
}

export interface SessionList {
  type: 'session.list';
  id: string;
}

export interface ToolApprovalResponse {
  type: 'tool.approval.response';
  id: string;
  toolCallId: string;
  approved: boolean;
  sessionApprove?: boolean;
}

export interface ThreadList {
  type: 'thread.list';
  id: string;
  includeArchived?: boolean;
}

export type ClientMessage = ChatSend | SessionList | ToolApprovalResponse | ThreadList;

// ── Server Message Types ────────────────────────────────────────────────

export interface ChatStreamStart {
  type: 'chat.stream.start';
  requestId: string;
  sessionId: string;
  model: string;
  routing?: { tier: 'high' | 'standard' | 'budget'; reason: string };
}

export interface ChatStreamDelta {
  type: 'chat.stream.delta';
  requestId: string;
  delta: string;
}

export interface ChatStreamEnd {
  type: 'chat.stream.end';
  requestId: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  cost: { inputCost: number; outputCost: number; totalCost: number };
}

export interface SessionCreated {
  type: 'session.created';
  sessionId: string;
  sessionKey: string;
}

export interface SessionListResponse {
  type: 'session.list';
  requestId: string;
  sessions: Array<{
    sessionId: string;
    sessionKey: string;
    model: string;
    createdAt: string;
    messageCount: number;
  }>;
}

export interface ToolCallNotify {
  type: 'tool.call';
  requestId: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
}

export interface ToolResultNotify {
  type: 'tool.result';
  requestId: string;
  toolCallId: string;
  toolName: string;
  result: unknown;
}

export interface ToolErrorNotify {
  type: 'tool.error';
  requestId: string;
  toolCallId: string;
  toolName: string;
  error: string;
}

export interface ToolApprovalRequest {
  type: 'tool.approval.request';
  requestId: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
  risk?: 'low' | 'medium' | 'high';
}

export interface ErrorMessage {
  type: 'error';
  requestId?: string;
  code: string;
  message: string;
}

export type ServerMessage =
  | ChatStreamStart
  | ChatStreamDelta
  | ChatStreamEnd
  | SessionCreated
  | SessionListResponse
  | ToolCallNotify
  | ToolResultNotify
  | ToolErrorNotify
  | ToolApprovalRequest
  | ErrorMessage;

// ── ChatMessage (display state) ─────────────────────────────────────────

export type ChatMessage =
  | {
      type: 'text';
      id: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: number;
      model?: string;
    }
  | {
      type: 'tool_call';
      id: string;
      toolCallId: string;
      toolName: string;
      args: unknown;
      result?: unknown;
      error?: string;
      status: 'pending' | 'running' | 'completed' | 'error';
    }
  | {
      type: 'tool_approval';
      id: string;
      toolCallId: string;
      toolName: string;
      args: unknown;
      risk?: string;
      status: 'pending' | 'approved' | 'denied';
    };

// ── Factory Functions ───────────────────────────────────────────────────
// Each generates a unique id using crypto.randomUUID().

export function createChatSend(
  content: string,
  opts?: { sessionId?: string; model?: string; agentId?: string },
): ChatSend {
  return {
    type: 'chat.send',
    id: crypto.randomUUID(),
    content,
    ...opts,
  };
}

export function createSessionList(): SessionList {
  return {
    type: 'session.list',
    id: crypto.randomUUID(),
  };
}

export function createToolApprovalResponse(
  toolCallId: string,
  approved: boolean,
  sessionApprove?: boolean,
): ToolApprovalResponse {
  return {
    type: 'tool.approval.response',
    id: crypto.randomUUID(),
    toolCallId,
    approved,
    sessionApprove,
  };
}

export function createThreadList(includeArchived?: boolean): ThreadList {
  return {
    type: 'thread.list',
    id: crypto.randomUUID(),
    includeArchived,
  };
}
