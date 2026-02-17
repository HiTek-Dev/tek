export { buildToolRegistry } from "./tool-registry.js";
export type { ToolRegistryOptions } from "./tool-registry.js";
export {
	createApprovalPolicy,
	checkApproval,
	recordSessionApproval,
	wrapToolWithApproval,
} from "./approval-gate.js";
export type { ApprovalPolicy } from "./approval-gate.js";
