import { Command } from '@tauri-apps/plugin-shell';
import { homeDir } from '@tauri-apps/api/path';

export interface ProcessResult {
  success: boolean;
  error?: string;
}

/**
 * Get the path to the tek CLI binary.
 * Installed at ~/tek/bin/tek by the install script.
 */
async function getTekBinPath(): Promise<string> {
  const home = await homeDir();
  return `${home}tek/bin/tek`;
}

/**
 * Start the gateway via the tek CLI.
 * Runs the tek binary directly using its installed path.
 */
export async function startGateway(): Promise<ProcessResult> {
  try {
    const tekPath = await getTekBinPath();
    const command = Command.create('node', [tekPath, 'gateway', 'start']);
    const output = await command.execute();

    if (output.code !== 0) {
      return {
        success: false,
        error: output.stderr || `Process exited with code ${output.code}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to start gateway',
    };
  }
}

/**
 * Stop the gateway via the tek CLI.
 * Runs the tek binary directly using its installed path.
 */
export async function stopGateway(): Promise<ProcessResult> {
  try {
    const tekPath = await getTekBinPath();
    const command = Command.create('node', [tekPath, 'gateway', 'stop']);
    const output = await command.execute();

    if (output.code !== 0) {
      return {
        success: false,
        error: output.stderr || `Process exited with code ${output.code}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to stop gateway',
    };
  }
}
