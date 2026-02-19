import { Command } from '@tauri-apps/plugin-shell';

export interface ProcessResult {
  success: boolean;
  error?: string;
}

/**
 * Start the gateway via the tek CLI.
 * Runs `tek gateway start` using the Tauri shell plugin.
 */
export async function startGateway(): Promise<ProcessResult> {
  try {
    const command = Command.create('tek', ['gateway', 'start']);
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
 * Runs `tek gateway stop` using the Tauri shell plugin.
 */
export async function stopGateway(): Promise<ProcessResult> {
  try {
    const command = Command.create('tek', ['gateway', 'stop']);
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
