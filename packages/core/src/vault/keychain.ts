import { Entry } from "@napi-rs/keyring";
import { KEYCHAIN_SERVICE } from "../config/index.js";

const SERVICE_NAME: string = KEYCHAIN_SERVICE;

const KNOWN_ACCOUNTS = [
	"api-key:anthropic",
	"api-key:openai",
	"api-key:venice",
	"api-key:google",
	"api-endpoint-token",
];

let migrated = false;

/**
 * Migrate keychain entries from old "agentspace" service to the current service name.
 * Runs once on first key access; subsequent calls are no-ops.
 */
function migrateKeychainEntries(): void {
	if (migrated || SERVICE_NAME === "agentspace") return;
	migrated = true;

	for (const account of KNOWN_ACCOUNTS) {
		try {
			const oldEntry = new Entry("agentspace", account);
			const password = oldEntry.getPassword();
			if (!password) continue;
			// Copy to new service
			const newEntry = new Entry(SERVICE_NAME, account);
			newEntry.setPassword(password);
			// Remove old entry
			oldEntry.deletePassword();
		} catch {
			// Entry doesn't exist in old service — skip
		}
	}
}

/**
 * Store a password in the OS keychain under the tek service.
 */
export function keychainSet(account: string, password: string): void {
	const entry = new Entry(SERVICE_NAME, account);
	entry.setPassword(password);
}

/**
 * Retrieve a password from the OS keychain.
 * Returns null if the entry does not exist.
 */
export function keychainGet(account: string): string | null {
	migrateKeychainEntries();
	try {
		const entry = new Entry(SERVICE_NAME, account);
		return entry.getPassword();
	} catch {
		return null;
	}
}

/**
 * Delete a password from the OS keychain.
 * Returns true if deleted, false if the entry was not found.
 */
export function keychainDelete(account: string): boolean {
	try {
		const entry = new Entry(SERVICE_NAME, account);
		entry.deletePassword();
		return true;
	} catch {
		return false;
	}
}
