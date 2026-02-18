import { getOrCreateAuthToken } from "@tek/cli/vault";

/**
 * Get the set of valid bearer auth keys for the key server.
 * Retrieves (or creates) the auth token from the OS keychain.
 */
export function getAuthKeys(): Set<string> {
	const token = getOrCreateAuthToken();
	return new Set([token]);
}
