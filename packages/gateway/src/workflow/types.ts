import { z } from "zod";

export const StepDefinitionSchema = z.object({
	id: z.string(),
	action: z.enum(["tool", "model", "noop"]),
	tool: z.string().optional(),
	args: z.record(z.string(), z.unknown()).optional(),
	prompt: z.string().optional(),
	outputSchema: z.record(z.string(), z.unknown()).optional(),
	approvalRequired: z.boolean().optional().default(false),
	onSuccess: z.string().optional(),
	onFailure: z.string().optional(),
	branches: z
		.array(z.object({ condition: z.string(), goto: z.string() }))
		.optional(),
	timeout: z.number().optional(),
});

export const WorkflowDefinitionSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	trigger: z.union([z.literal("manual"), z.string()]).optional().default("manual"),
	steps: z.array(StepDefinitionSchema).min(1),
});

export const StepResultSchema = z.object({
	status: z.enum(["success", "failure", "paused"]),
	output: z.unknown(),
	completedAt: z.string().optional(),
});

export const WorkflowExecutionStateSchema = z.object({
	id: z.string(),
	workflowId: z.string(),
	status: z.enum(["running", "paused", "completed", "failed"]),
	currentStepId: z.string().optional(),
	stepResults: z.record(z.string(), StepResultSchema),
	startedAt: z.string(),
	pausedAt: z.string().optional(),
	completedAt: z.string().optional(),
	error: z.string().optional(),
	triggeredBy: z.enum(["manual", "cron", "heartbeat"]),
});

export type StepDefinition = z.infer<typeof StepDefinitionSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type StepResult = z.infer<typeof StepResultSchema>;
export type WorkflowExecutionState = z.infer<typeof WorkflowExecutionStateSchema>;
