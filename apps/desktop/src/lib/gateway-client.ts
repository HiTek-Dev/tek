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

// ── Vault & Config Client Messages ──────────────────────────────────

export interface VaultKeysList {
  type: 'vault.keys.list';
  id: string;
}

export interface VaultKeysSet {
  type: 'vault.keys.set';
  id: string;
  provider: string;
  key: string;
}

export interface VaultKeysDelete {
  type: 'vault.keys.delete';
  id: string;
  provider: string;
}

export interface VaultKeysTest {
  type: 'vault.keys.test';
  id: string;
  provider: string;
}

export interface ConfigGet {
  type: 'config.get';
  id: string;
}

export interface ConfigUpdate {
  type: 'config.update';
  id: string;
  patch: Record<string, unknown>;
}

export interface OllamaDiscover {
  type: 'ollama.discover';
  id: string;
  url: string;
}

export interface ProviderModelsList {
  type: 'provider.models.list';
  id: string;
  provider: string;
}

// ── Agent Management Client Messages ────────────────────────────────

export interface AgentIdentityRead {
  type: 'agent.identity.read';
  id: string;
  agentId: string;
  file: string;
}

export interface AgentIdentityWrite {
  type: 'agent.identity.write';
  id: string;
  agentId: string;
  file: string;
  content: string;
}

export interface AgentCreateMsg {
  type: 'agent.create';
  id: string;
  agent: {
    id: string;
    name?: string;
    model?: string;
    description?: string;
    personalityPreset?: string;
    purpose?: string;
  };
}

export interface AgentUpdateMsg {
  type: 'agent.update';
  id: string;
  agentId: string;
  patch: Record<string, unknown>;
}

export interface AgentDeleteMsg {
  type: 'agent.delete';
  id: string;
  agentId: string;
}

export interface TelegramUsersList {
  type: 'telegram.users.list';
  id: string;
}

export interface TelegramUsersUpdate {
  type: 'telegram.users.update';
  id: string;
  telegramChatId: number;
  approved: boolean;
}

// ── Chat Model Switch Client Messages ───────────────────────────────

export interface ChatModelSwitch {
  type: 'chat.model.switch';
  id: string;
  sessionId: string;
  newModel: string;
  keepContext: boolean;
}

export interface ContextDump {
  type: 'context.dump';
  id: string;
  sessionId: string;
}

// ── Gateway Logs & Status ───────────────────────────────────────────

export interface GatewayLogsSubscribe {
  type: 'gateway.logs.subscribe';
  id: string;
}

export interface GatewayLogsUnsubscribe {
  type: 'gateway.logs.unsubscribe';
  id: string;
}

export interface GatewayStatusRequest {
  type: 'gateway.status';
  id: string;
}

export type ClientMessage =
  | ChatSend
  | SessionList
  | ToolApprovalResponse
  | ThreadList
  | VaultKeysList
  | VaultKeysSet
  | VaultKeysDelete
  | VaultKeysTest
  | ConfigGet
  | ConfigUpdate
  | OllamaDiscover
  | ProviderModelsList
  | AgentIdentityRead
  | AgentIdentityWrite
  | AgentCreateMsg
  | AgentUpdateMsg
  | AgentDeleteMsg
  | TelegramUsersList
  | TelegramUsersUpdate
  | ChatModelSwitch
  | ContextDump
  | GatewayLogsSubscribe
  | GatewayLogsUnsubscribe
  | GatewayStatusRequest;

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
  contentType?: 'text' | 'code';
}

export interface ChatStreamReasoning {
  type: 'chat.stream.reasoning';
  requestId: string;
  delta: string;
}

export interface ChatStreamSource {
  type: 'chat.stream.source';
  requestId: string;
  source: { url: string; title?: string };
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

export interface TodoUpdate {
  type: 'todo.update';
  requestId: string;
  todos: Array<{
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm?: string;
  }>;
}

export interface FailureDetected {
  type: 'failure.detected';
  requestId: string;
  pattern: string;
  description: string;
  suggestedAction: string;
  affectedTool?: string;
}

// ── Vault & Config Server Responses ─────────────────────────────────

export interface VaultKeysListResult {
  type: 'vault.keys.list.result';
  id: string;
  providers: Array<{ provider: string; configured: boolean }>;
}

export interface VaultKeysSetResult {
  type: 'vault.keys.set.result';
  id: string;
  provider: string;
  success: boolean;
  error?: string;
}

export interface VaultKeysDeleteResult {
  type: 'vault.keys.delete.result';
  id: string;
  provider: string;
  success: boolean;
  error?: string;
}

export interface VaultKeysTestResult {
  type: 'vault.keys.test.result';
  id: string;
  provider: string;
  valid: boolean;
  error?: string;
}

export interface ConfigGetResult {
  type: 'config.get.result';
  id: string;
  config: Record<string, unknown>;
}

export interface ConfigUpdateResult {
  type: 'config.update.result';
  id: string;
  success: boolean;
  error?: string;
}

export interface OllamaDiscoverResult {
  type: 'ollama.discover.result';
  id: string;
  models: Array<{ name: string; size?: number; modifiedAt?: string }>;
  error?: string;
}

export interface ProviderModelsListResult {
  type: 'provider.models.list.result';
  id: string;
  provider: string;
  models: Array<{ modelId: string; name: string; tier?: 'high' | 'standard' | 'budget' }>;
}

// ── Agent Management Server Responses ───────────────────────────────

export interface AgentIdentityReadResult {
  type: 'agent.identity.read.result';
  id: string;
  agentId: string;
  file: string;
  content: string;
  exists: boolean;
}

export interface AgentIdentityWriteResult {
  type: 'agent.identity.write.result';
  id: string;
  success: boolean;
  error?: string;
}

export interface AgentCreateResult {
  type: 'agent.create.result';
  id: string;
  success: boolean;
  agentId?: string;
  error?: string;
}

export interface AgentUpdateResult {
  type: 'agent.update.result';
  id: string;
  success: boolean;
  error?: string;
}

export interface AgentDeleteResult {
  type: 'agent.delete.result';
  id: string;
  success: boolean;
  error?: string;
}

export interface TelegramUsersListResult {
  type: 'telegram.users.list.result';
  id: string;
  users: Array<{
    id: string;
    telegramChatId: number;
    telegramUserId: number;
    telegramUsername: string | null;
    pairedAt: string;
    active: boolean;
    approved: boolean;
  }>;
}

export interface TelegramUsersUpdateResult {
  type: 'telegram.users.update.result';
  id: string;
  success: boolean;
  error?: string;
}

// ── Chat Model Switch Server Responses ──────────────────────────────

export interface ChatModelSwitched {
  type: 'chat.model.switched';
  id: string;
  sessionId: string;
  newModel: string;
  preserved: boolean;
}

export interface ContextDumpResult {
  type: 'context.dump.result';
  id: string;
  sessionId: string;
  messageCount: number;
  byteCount: number;
}

// ── Sub-Process & Logs Server Messages ──────────────────────────────

export interface SubprocessStart {
  type: 'subprocess.start';
  requestId: string;
  processId: string;
  name: string;
  processType: 'tool' | 'sub-agent' | 'workflow';
}

export interface SubprocessLog {
  type: 'subprocess.log';
  requestId: string;
  processId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface SubprocessEnd {
  type: 'subprocess.end';
  requestId: string;
  processId: string;
  status: 'completed' | 'error';
  durationMs: number;
  result?: unknown;
}

export interface GatewayLogEntry {
  type: 'gateway.log.entry';
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  module?: string;
}

// ── Gateway Status Server Response ──────────────────────────────────

export interface GatewayStatusResult {
  type: 'gateway.status.result';
  id: string;
  uptime: number;
  port: number;
  pid: number;
  connections: number;
  sessions: number;
  providers: Array<{ provider: string; configured: boolean }>;
  version?: string;
}

export type ServerMessage =
  | ChatStreamStart
  | ChatStreamDelta
  | ChatStreamEnd
  | ChatStreamReasoning
  | ChatStreamSource
  | SessionCreated
  | SessionListResponse
  | ToolCallNotify
  | ToolResultNotify
  | ToolErrorNotify
  | ToolApprovalRequest
  | ErrorMessage
  | TodoUpdate
  | FailureDetected
  | VaultKeysListResult
  | VaultKeysSetResult
  | VaultKeysDeleteResult
  | VaultKeysTestResult
  | ConfigGetResult
  | ConfigUpdateResult
  | OllamaDiscoverResult
  | ProviderModelsListResult
  | AgentIdentityReadResult
  | AgentIdentityWriteResult
  | AgentCreateResult
  | AgentUpdateResult
  | AgentDeleteResult
  | TelegramUsersListResult
  | TelegramUsersUpdateResult
  | ChatModelSwitched
  | ContextDumpResult
  | SubprocessStart
  | SubprocessLog
  | SubprocessEnd
  | GatewayLogEntry
  | GatewayStatusResult;

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
    }
  | {
      type: 'reasoning';
      id: string;
      content: string;
      timestamp: number;
    }
  | {
      type: 'sources';
      id: string;
      sources: Array<{ url: string; title?: string }>;
      timestamp: number;
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

// ── RPC Message Factories ───────────────────────────────────────────

export function createVaultKeysList(): VaultKeysList {
  return { type: 'vault.keys.list', id: crypto.randomUUID() };
}

export function createVaultKeysSet(provider: string, key: string): VaultKeysSet {
  return { type: 'vault.keys.set', id: crypto.randomUUID(), provider, key };
}

export function createVaultKeysDelete(provider: string): VaultKeysDelete {
  return { type: 'vault.keys.delete', id: crypto.randomUUID(), provider };
}

export function createVaultKeysTest(provider: string): VaultKeysTest {
  return { type: 'vault.keys.test', id: crypto.randomUUID(), provider };
}

export function createConfigGet(): ConfigGet {
  return { type: 'config.get', id: crypto.randomUUID() };
}

export function createConfigUpdate(patch: Record<string, unknown>): ConfigUpdate {
  return { type: 'config.update', id: crypto.randomUUID(), patch };
}

export function createOllamaDiscover(url: string): OllamaDiscover {
  return { type: 'ollama.discover', id: crypto.randomUUID(), url };
}

export function createProviderModelsList(provider: string): ProviderModelsList {
  return { type: 'provider.models.list', id: crypto.randomUUID(), provider };
}

export function createAgentIdentityRead(agentId: string, file: string): AgentIdentityRead {
  return { type: 'agent.identity.read', id: crypto.randomUUID(), agentId, file };
}

export function createAgentIdentityWrite(agentId: string, file: string, content: string): AgentIdentityWrite {
  return { type: 'agent.identity.write', id: crypto.randomUUID(), agentId, file, content };
}

export function createAgentCreate(agent: AgentCreateMsg['agent']): AgentCreateMsg {
  return { type: 'agent.create', id: crypto.randomUUID(), agent };
}

export function createAgentUpdate(agentId: string, patch: Record<string, unknown>): AgentUpdateMsg {
  return { type: 'agent.update', id: crypto.randomUUID(), agentId, patch };
}

export function createAgentDelete(agentId: string): AgentDeleteMsg {
  return { type: 'agent.delete', id: crypto.randomUUID(), agentId };
}

export function createTelegramUsersList(): TelegramUsersList {
  return { type: 'telegram.users.list', id: crypto.randomUUID() };
}

export function createTelegramUsersUpdate(telegramChatId: number, approved: boolean): TelegramUsersUpdate {
  return { type: 'telegram.users.update', id: crypto.randomUUID(), telegramChatId, approved };
}

export function createChatModelSwitch(sessionId: string, newModel: string, keepContext: boolean): ChatModelSwitch {
  return { type: 'chat.model.switch', id: crypto.randomUUID(), sessionId, newModel, keepContext };
}

export function createContextDump(sessionId: string): ContextDump {
  return { type: 'context.dump', id: crypto.randomUUID(), sessionId };
}

export function createGatewayStatus(): GatewayStatusRequest {
  return { type: 'gateway.status', id: crypto.randomUUID() };
}
