export {
	AppConfigSchema,
	ApiEndpointConfigSchema,
	SecurityModeSchema,
	MCPServerConfigSchema,
	MCPTransportSchema,
	ApprovalTierSchema,
	ToolApprovalConfigSchema,
	loadConfig,
	saveConfig,
	configExists,
	CONFIG_DIR,
	CONFIG_PATH,
	DB_PATH,
	RUNTIME_PATH,
	isPathWithinWorkspace,
	PROJECT_NAME,
	DISPLAY_NAME,
	SCOPE,
	CONFIG_DIR_NAME,
	CLI_COMMAND,
	DB_NAME,
	KEYCHAIN_SERVICE,
} from "./config/index.js";
export type {
	AppConfig,
	SecurityMode,
	MCPServerConfig,
	ToolApprovalConfig,
	ApprovalTier,
} from "./config/index.js";

export { generateAuthToken } from "./crypto/index.js";

export { TekError, AgentSpaceError, ConfigError, VaultError, AuthError } from "./errors.js";

export { createLogger } from "./logger.js";

export {
	SkillMetadataSchema,
	discoverSkills,
	getSkillsDirs,
	formatSkillsForContext,
	writeSkill,
} from "./skills/index.js";
export type { SkillMetadata, SkillTier, LoadedSkill } from "./skills/index.js";
