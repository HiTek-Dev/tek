import { z } from "zod";

export const SecurityModeSchema = z.enum(["full-control", "limited-control"]);

export const ApiEndpointConfigSchema = z.object({
	port: z.number().default(3271),
	host: z.literal("127.0.0.1").default("127.0.0.1"),
});

export const MCPTransportSchema = z.enum(["stdio", "http", "sse"]);

export const MCPServerConfigSchema = z
	.object({
		command: z.string().optional(),
		args: z.array(z.string()).optional(),
		env: z.record(z.string(), z.string()).optional(),
		url: z.string().optional(),
		transport: MCPTransportSchema.optional(),
	})
	.refine((cfg) => cfg.command != null || cfg.url != null, {
		message: "MCP server config must specify at least 'command' (stdio) or 'url' (http/sse)",
	});

export const ApprovalTierSchema = z.enum(["auto", "session", "always"]);

export const ToolApprovalConfigSchema = z.object({
	defaultTier: ApprovalTierSchema.default("session"),
	perTool: z.record(z.string(), ApprovalTierSchema).optional(),
	approvalTimeout: z.number().default(60000),
});

export const OllamaEndpointSchema = z.object({
	name: z.string(),
	url: z.string().url(),
});

export type OllamaEndpoint = z.infer<typeof OllamaEndpointSchema>;

export const ModelAliasSchema = z.object({
	alias: z.string(),
	modelId: z.string(),
});

export const AgentDefinitionSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	model: z.string().optional(),
	description: z.string().optional(),
	accessMode: z.enum(["full", "limited"]).default("full"),
	workspaceDir: z.string().optional(),
	personalityPreset: z.string().optional(),
	purpose: z.string().optional(),
	createdAt: z.string().datetime().optional(),
});

export const AgentsConfigSchema = z.object({
	list: z.array(AgentDefinitionSchema).default([]),
	defaultAgentId: z.string().default("default"),
});

export const AppConfigSchema = z.object({
	securityMode: SecurityModeSchema,
	workspaceDir: z.string().optional(),
	apiEndpoint: ApiEndpointConfigSchema.default(() => ({ port: 3271, host: "127.0.0.1" as const })),
	onboardingComplete: z.boolean().default(false),
	createdAt: z.string().datetime(),
	mcpServers: z.record(z.string(), MCPServerConfigSchema).optional(),
	toolApproval: ToolApprovalConfigSchema.optional(),
	skillsDir: z.string().optional(),
	ollamaEndpoints: z.array(OllamaEndpointSchema).optional(),
	defaultModel: z.string().optional(),
	modelAliases: z.array(ModelAliasSchema).optional(),
	agentName: z.string().optional(),
	userDisplayName: z.string().optional(),
	agents: AgentsConfigSchema.optional(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;
export type ModelAlias = z.infer<typeof ModelAliasSchema>;
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;
export type ToolApprovalConfig = z.infer<typeof ToolApprovalConfigSchema>;
export type ApprovalTier = z.infer<typeof ApprovalTierSchema>;
