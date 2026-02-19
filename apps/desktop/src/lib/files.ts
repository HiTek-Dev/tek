import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';

export interface IdentityFileInfo {
  name: string;
  filename: string;
  description: string;
}

export const IDENTITY_FILES: IdentityFileInfo[] = [
  { name: 'Soul', filename: 'SOUL.md', description: 'Core personality and values' },
  { name: 'Identity', filename: 'IDENTITY.md', description: 'Background, expertise, communication style' },
  { name: 'User', filename: 'USER.md', description: 'Information about the user' },
  { name: 'Style', filename: 'STYLE.md', description: 'Tone, humor, formatting preferences' },
];

export async function getConfigDir(): Promise<string> {
  const home = await homeDir();
  return await join(home, '.config', 'tek');
}

async function getIdentityDir(agentId?: string): Promise<string> {
  const home = await homeDir();
  if (agentId && agentId !== 'default') {
    return await join(home, '.config', 'tek', 'agents', agentId);
  }
  return await join(home, '.config', 'tek', 'memory');
}

export async function getAgentDir(agentId: string): Promise<string> {
  const home = await homeDir();
  return await join(home, '.config', 'tek', 'agents', agentId);
}

export async function loadIdentityFile(filename: string, agentId?: string): Promise<string | null> {
  const dir = await getIdentityDir(agentId);
  const filePath = await join(dir, filename);

  const fileExists = await exists(filePath);
  if (!fileExists) {
    return null;
  }

  return await readTextFile(filePath);
}

export async function saveIdentityFile(filename: string, content: string, agentId?: string): Promise<void> {
  const dir = await getIdentityDir(agentId);

  const dirExists = await exists(dir);
  if (!dirExists) {
    await mkdir(dir, { recursive: true });
  }

  const filePath = await join(dir, filename);
  await writeTextFile(filePath, content);
}

export async function ensureAgentDir(agentId: string): Promise<void> {
  const dir = await getAgentDir(agentId);
  const dirExists = await exists(dir);
  if (!dirExists) {
    await mkdir(dir, { recursive: true });
  }
}
