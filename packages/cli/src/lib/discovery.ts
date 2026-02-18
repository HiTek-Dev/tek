import { readFileSync, existsSync } from "node:fs";
import { RUNTIME_PATH } from "@tek/core";

export interface RuntimeInfo {
	pid: number;
	port: number;
	startedAt: string;
}

/**
 * Discover a running gateway by reading runtime.json and verifying PID liveness.
 * Returns null if the gateway is not running or the runtime file is missing.
 */
export function discoverGateway(): RuntimeInfo | null {
	if (!existsSync(RUNTIME_PATH)) {
		return null;
	}

	let data: RuntimeInfo;
	try {
		data = JSON.parse(readFileSync(RUNTIME_PATH, "utf-8")) as RuntimeInfo;
	} catch {
		return null;
	}

	// Signal 0 checks if the process exists without sending a signal
	try {
		process.kill(data.pid, 0);
	} catch {
		// Process is dead — stale runtime.json
		return null;
	}

	return data;
}
