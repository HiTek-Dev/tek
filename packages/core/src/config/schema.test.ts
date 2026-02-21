import { describe, it, expect } from "vitest";
import {
	AppConfigSchema,
	MCPServerConfigSchema,
	ToolApprovalConfigSchema,
} from "./schema.js";

// ── AppConfigSchema Tests ────────────────────────────────────────────

describe("AppConfigSchema", () => {
	const FULL_CONFIG = {
		securityMode: "full-control" as const,
		workspaceDir: "/home/user/workspace",
		apiEndpoint: { port: 3271, host: "127.0.0.1" as const },
		onboardingComplete: true,
		createdAt: "2026-01-01T00:00:00Z",
		mcpServers: {
			filesystem: {
				command: "node",
				args: ["server.js"],
				env: { HOME: "/home/user" },
			},
		},
		toolApproval: {
			defaultTier: "session" as const,
			perTool: { read_file: "auto" as const },
			approvalTimeout: 60000,
		},
		skillsDir: "/home/user/.tek/skills",
		ollamaEndpoints: [
			{ name: "local", url: "http://localhost:11434" },
		],
		defaultModel: "claude-3",
		modelAliases: [{ alias: "fast", modelId: "claude-3-haiku" }],
		agentName: "Tek",
		userDisplayName: "User",
		agents: {
			list: [
				{
					id: "default",
					name: "Default Agent",
					model: "claude-3",
					description: "General assistant",
					accessMode: "full" as const,
				},
			],
			defaultAgentId: "default",
		},
	};

	it("round-trips a full config without data loss", () => {
		const parsed = AppConfigSchema.parse(FULL_CONFIG);
		expect(parsed).toEqual(FULL_CONFIG);
	});

	it("applies correct defaults for minimal config", () => {
		const minimal = {
			securityMode: "full-control",
			createdAt: new Date().toISOString(),
		};
		const parsed = AppConfigSchema.parse(minimal);
		expect(parsed.apiEndpoint.port).toBe(3271);
		expect(parsed.apiEndpoint.host).toBe("127.0.0.1");
		expect(parsed.onboardingComplete).toBe(false);
	});

	it("rejects missing required fields", () => {
		expect(() => AppConfigSchema.parse({})).toThrow();
	});

	it("rejects invalid securityMode", () => {
		expect(() =>
			AppConfigSchema.parse({
				securityMode: "invalid",
				createdAt: "2026-01-01T00:00:00Z",
			}),
		).toThrow();
	});
});

// ── MCPServerConfigSchema Tests ──────────────────────────────────────

describe("MCPServerConfigSchema", () => {
	it("accepts stdio config with command", () => {
		const result = MCPServerConfigSchema.parse({
			command: "node",
			args: ["server.js"],
		});
		expect(result.command).toBe("node");
		expect(result.args).toEqual(["server.js"]);
	});

	it("accepts http config with url", () => {
		const result = MCPServerConfigSchema.parse({
			url: "http://localhost:3000",
			transport: "http",
		});
		expect(result.url).toBe("http://localhost:3000");
		expect(result.transport).toBe("http");
	});

	it("rejects config missing both command and url", () => {
		expect(() =>
			MCPServerConfigSchema.parse({ args: ["foo"] }),
		).toThrow(/command.*url|url.*command/i);
	});
});

// ── ToolApprovalConfigSchema Tests ───────────────────────────────────

describe("ToolApprovalConfigSchema", () => {
	it("applies correct defaults for empty object", () => {
		const parsed = ToolApprovalConfigSchema.parse({});
		expect(parsed.defaultTier).toBe("session");
		expect(parsed.approvalTimeout).toBe(60000);
	});
});

// ── Migration Simulation Tests ───────────────────────────────────────

describe("Config migration (older shapes)", () => {
	it("accepts config without agents field", () => {
		const config = {
			securityMode: "full-control",
			createdAt: "2026-01-01T00:00:00Z",
			onboardingComplete: true,
			apiEndpoint: { port: 3271, host: "127.0.0.1" as const },
		};
		const parsed = AppConfigSchema.parse(config);
		expect(parsed.agents).toBeUndefined();
	});

	it("accepts config without ollamaEndpoints or modelAliases", () => {
		const config = {
			securityMode: "limited-control",
			createdAt: "2026-01-01T00:00:00Z",
		};
		const parsed = AppConfigSchema.parse(config);
		expect(parsed.ollamaEndpoints).toBeUndefined();
		expect(parsed.modelAliases).toBeUndefined();
	});
});
