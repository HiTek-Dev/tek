import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';

export interface AppConfig {
  securityMode?: 'full' | 'limited';
  workspaceDir?: string;
  defaultModel?: string;
  modelAliases?: Record<string, string>;
  configuredProviders?: string[];
  mcpServers?: Record<string, { command: string; args?: string[] }>;
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
    return JSON.parse(content) as AppConfig;
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
  const merged = { ...existing, ...config };
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
