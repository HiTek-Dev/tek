import { describe, expect, it, vi } from "vitest";
import {
	checkApproval,
	createApprovalPolicy,
	recordSessionApproval,
	wrapToolWithApproval,
} from "./approval-gate.js";

// ── createApprovalPolicy ────────────────────────────────────────────

describe("createApprovalPolicy", () => {
	it("returns default policy with session tier and empty perTool", () => {
		const policy = createApprovalPolicy();
		expect(policy.defaultTier).toBe("session");
		expect(policy.perTool).toEqual({});
		expect(policy.sessionApprovals.size).toBe(0);
	});

	it("accepts custom config", () => {
		const policy = createApprovalPolicy({
			defaultTier: "always",
			perTool: { shell: "auto" },
		});
		expect(policy.defaultTier).toBe("always");
		expect(policy.perTool).toEqual({ shell: "auto" });
		expect(policy.sessionApprovals.size).toBe(0);
	});
});

// ── checkApproval ───────────────────────────────────────────────────

describe("checkApproval", () => {
	it("returns false for auto tier", () => {
		const policy = createApprovalPolicy({ defaultTier: "auto" });
		expect(checkApproval("any-tool", policy)).toBe(false);
	});

	it("returns true for always tier", () => {
		const policy = createApprovalPolicy({ defaultTier: "always" });
		expect(checkApproval("any-tool", policy)).toBe(true);
	});

	it("returns true for session tier on first call", () => {
		const policy = createApprovalPolicy({ defaultTier: "session" });
		expect(checkApproval("shell", policy)).toBe(true);
	});

	it("returns false for session tier after approval recorded", () => {
		const policy = createApprovalPolicy({ defaultTier: "session" });
		recordSessionApproval("shell", policy);
		expect(checkApproval("shell", policy)).toBe(false);
	});

	it("still requires approval for different tool after approving one", () => {
		const policy = createApprovalPolicy({ defaultTier: "session" });
		recordSessionApproval("shell", policy);
		expect(checkApproval("fetch", policy)).toBe(true);
	});

	it("uses perTool override over defaultTier", () => {
		const policy = createApprovalPolicy({
			defaultTier: "session",
			perTool: { shell: "auto" },
		});
		expect(checkApproval("shell", policy)).toBe(false); // auto -> false
		expect(checkApproval("fetch", policy)).toBe(true); // session -> true
	});
});

// ── recordSessionApproval ───────────────────────────────────────────

describe("recordSessionApproval", () => {
	it("adds tool to sessionApprovals set", () => {
		const policy = createApprovalPolicy();
		recordSessionApproval("shell", policy);
		expect(policy.sessionApprovals.has("shell")).toBe(true);
	});

	it("is idempotent — recording twice does not break", () => {
		const policy = createApprovalPolicy();
		recordSessionApproval("shell", policy);
		recordSessionApproval("shell", policy);
		expect(policy.sessionApprovals.size).toBe(1);
		expect(policy.sessionApprovals.has("shell")).toBe(true);
	});
});

// ── wrapToolWithApproval ────────────────────────────────────────────

describe("wrapToolWithApproval", () => {
	it("adds _approvalTier matching effective tier", () => {
		const policy = createApprovalPolicy({ defaultTier: "session" });
		const tool = { execute: vi.fn() };
		const wrapped = wrapToolWithApproval("shell", tool, policy);
		expect(wrapped._approvalTier).toBe("session");
	});

	it("preserves original properties", () => {
		const policy = createApprovalPolicy();
		const executeFn = vi.fn();
		const tool = { execute: executeFn, description: "run shell" };
		const wrapped = wrapToolWithApproval("shell", tool, policy);
		expect(wrapped.execute).toBe(executeFn);
		expect(wrapped.description).toBe("run shell");
	});

	it("uses perTool tier for _approvalTier", () => {
		const policy = createApprovalPolicy({
			defaultTier: "session",
			perTool: { shell: "auto" },
		});
		const tool = { execute: vi.fn() };
		const wrapped = wrapToolWithApproval("shell", tool, policy);
		expect(wrapped._approvalTier).toBe("auto");
	});
});
