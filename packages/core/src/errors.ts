/**
 * Base error class for all Tek errors.
 */
export class TekError extends Error {
	readonly code: string;

	constructor(message: string, code: string) {
		super(message);
		this.name = "TekError";
		this.code = code;
	}
}

/** @deprecated Use TekError instead */
export const AgentSpaceError = TekError;

/**
 * Error related to configuration loading or validation.
 */
export class ConfigError extends TekError {
	constructor(message: string) {
		super(message, "CONFIG_ERROR");
		this.name = "ConfigError";
	}
}

/**
 * Error related to the credential vault or keychain operations.
 */
export class VaultError extends TekError {
	constructor(message: string) {
		super(message, "VAULT_ERROR");
		this.name = "VaultError";
	}
}

/**
 * Error related to authentication or authorization.
 */
export class AuthError extends TekError {
	constructor(message: string) {
		super(message, "AUTH_ERROR");
		this.name = "AuthError";
	}
}
