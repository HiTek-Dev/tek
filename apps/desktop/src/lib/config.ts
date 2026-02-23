import { homeDir, join } from "@tauri-apps/api/path";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";

export interface AgentDefinition {
  id: string;
  name?: string;
  model?: string;
  description?: string;
}

export interface TekConfig {
  agents?: {
    list: AgentDefinition[];
    defaultAgentId?: string;
  };
  defaultModel?: string;
  agentName?: string;
  onboardingComplete?: boolean;
}

/**
 * Load the Tek configuration from ~/.config/tek/config.json via Tauri FS plugin.
 *
 * Returns TekConfig if found, null if the file doesn't exist.
 */
export async function loadConfig(): Promise<TekConfig | null> {
  try {
    const home = await homeDir();
    const path = await join(home, ".config", "tek", "config.json");

    if (!(await exists(path))) {
      return null;
    }

    const content = await readTextFile(path);
    return JSON.parse(content) as TekConfig;
  } catch {
    // File read error or JSON parse error
    return null;
  }
}
