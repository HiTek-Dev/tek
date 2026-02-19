import { readTextFile, exists } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';

export interface RuntimeInfo {
  pid: number;
  port: number;
  startedAt: string;
}

/**
 * Discover a running gateway by reading runtime.json via Tauri FS plugin.
 * Returns null if the gateway is not running or the runtime file is missing.
 */
export async function discoverGateway(): Promise<RuntimeInfo | null> {
  try {
    const home = await homeDir();
    const path = await join(home, '.config', 'tek', 'runtime.json');

    if (!(await exists(path))) {
      return null;
    }

    const content = await readTextFile(path);
    const data = JSON.parse(content) as RuntimeInfo;

    if (!data.pid || !data.port || !data.startedAt) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}
