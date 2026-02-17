import type { ApprovalTier, ToolApprovalConfig } from "@agentspace/core";

/**
 * Policy governing which tools require approval before execution.
 */
export interface ApprovalPolicy {
	defaultTier: ApprovalTier;
	perTool: Record<string, ApprovalTier>;
	sessionApprovals: Set<string>;
}

/**
 * Create an approval policy from config, defaulting to session tier.
 */
export function createApprovalPolicy(
	config?: ToolApprovalConfig,
): ApprovalPolicy {
	return {
		defaultTier: config?.defaultTier ?? "session",
		perTool: config?.perTool ?? {},
		sessionApprovals: new Set<string>(),
	};
}

/**
 * Get the effective approval tier for a tool.
 */
function getTier(name: string, policy: ApprovalPolicy): ApprovalTier {
	return policy.perTool[name] ?? policy.defaultTier;
}

/**
 * Determine whether a tool needs approval based on the policy.
 * Returns a boolean or a function that checks session approvals.
 *
 * For AI SDK integration, the `needsApproval` property on tools controls
 * whether the model should request human confirmation before calling a tool.
 */
export function checkApproval(
	name: string,
	policy: ApprovalPolicy,
): boolean {
	const tier = getTier(name, policy);

	switch (tier) {
		case "auto":
			return false;
		case "always":
			return true;
		case "session":
			// Session tier: needs approval unless already approved in this session
			return !policy.sessionApprovals.has(name);
		default:
			return true;
	}
}

/**
 * Record that a tool has been approved for the current session.
 */
export function recordSessionApproval(
	name: string,
	policy: ApprovalPolicy,
): void {
	policy.sessionApprovals.add(name);
}

/**
 * Wrap a tool object by adding approval metadata based on policy.
 * Returns a new tool object with the same properties plus needsApproval info.
 */
export function wrapToolWithApproval<T extends Record<string, unknown>>(
	name: string,
	originalTool: T,
	policy: ApprovalPolicy,
): T & { _approvalTier: ApprovalTier } {
	const tier = getTier(name, policy);
	return {
		...originalTool,
		_approvalTier: tier,
	};
}
