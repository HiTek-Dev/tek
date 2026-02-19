import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';

export interface AgentDefinition {
  id: string;
  name?: string;
  model?: string;
  description?: string;
  accessMode?: 'full' | 'limited';
}

export interface AgentsConfig {
  list: AgentDefinition[];
  defaultAgentId: string;
}

export interface AppConfig {
  securityMode?: 'full' | 'limited';
  workspaceDir?: string;
  defaultModel?: string;
  modelAliases?: Record<string, string>;
  configuredProviders?: string[];
  mcpServers?: Record<string, { command: string; args?: string[] }>;
  agentName?: string;
  userDisplayName?: string;
  agents?: AgentsConfig;
  [key: string]: unknown;
}

const CONFIG_DIR_NAME = 'tek';
const CONFIG_FILE = 'config.json';

async function getConfigDir(): Promise<string> {
  const home = await homeDir();
  return join(home, '.config', CONFIG_DIR_NAME);
}

async function getConfigPath(): Promise<string> {
  const dir = await getConfigDir();
  return join(dir, CONFIG_FILE);
}

export async function loadConfig(): Promise<AppConfig | null> {
  try {
    const configPath = await getConfigPath();
    const fileExists = await exists(configPath);
    if (!fileExists) {
      return null;
    }
    const content = await readTextFile(configPath);
    const raw = JSON.parse(content);

    // Normalize modelAliases: core stores as Array<{alias, modelId}>, desktop expects Record<string, string>
    if (Array.isArray(raw.modelAliases)) {
      const record: Record<string, string> = {};
      for (const entry of raw.modelAliases) {
        if (entry && typeof entry === 'object' && entry.alias && entry.modelId) {
          record[entry.alias] = entry.modelId;
        }
      }
      raw.modelAliases = record;
    }

    return raw as AppConfig;
  } catch {
    return null;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const configDir = await getConfigDir();
  const configPath = await getConfigPath();

  // Load existing config to preserve unknown fields
  let existing: Record<string, unknown> = {};
  try {
    const fileExists = await exists(configPath);
    if (fileExists) {
      const content = await readTextFile(configPath);
      existing = JSON.parse(content);
    }
  } catch {
    // If we can't read existing, start fresh
  }

  // Merge: existing fields preserved, new values override
  const merged = { ...existing, ...config } as Record<string, unknown>;

  // Normalize modelAliases back to array format for core schema compatibility
  if (merged.modelAliases && !Array.isArray(merged.modelAliases)) {
    const record = merged.modelAliases as Record<string, string>;
    merged.modelAliases = Object.entries(record).map(([alias, modelId]) => ({ alias, modelId }));
  }

  const json = JSON.stringify(merged, null, 2);

  // Ensure config directory exists
  try {
    const dirExists = await exists(configDir);
    if (!dirExists) {
      await mkdir(configDir, { recursive: true });
    }
  } catch {
    // Directory may already exist
  }

  await writeTextFile(configPath, json);
}
