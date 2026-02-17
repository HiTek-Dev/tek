import { eq, and } from "drizzle-orm";
import { getDb, workflows, workflowExecutions } from "@agentspace/db";
import type { WorkflowExecutionState } from "./types.js";

/**
 * Save or update a workflow execution state to SQLite.
 * Serializes stepResults as a JSON string.
 */
export function saveExecution(execution: WorkflowExecutionState): void {
	const db = getDb();

	db.insert(workflowExecutions)
		.values({
			id: execution.id,
			workflowId: execution.workflowId,
			status: execution.status,
			currentStepId: execution.currentStepId ?? null,
			stepResults: JSON.stringify(execution.stepResults),
			triggeredBy: execution.triggeredBy,
			startedAt: execution.startedAt,
			pausedAt: execution.pausedAt ?? null,
			completedAt: execution.completedAt ?? null,
			error: execution.error ?? null,
		})
		.onConflictDoUpdate({
			target: workflowExecutions.id,
			set: {
				status: execution.status,
				currentStepId: execution.currentStepId ?? null,
				stepResults: JSON.stringify(execution.stepResults),
				pausedAt: execution.pausedAt ?? null,
				completedAt: execution.completedAt ?? null,
				error: execution.error ?? null,
			},
		})
		.run();
}

/**
 * Load a workflow execution state from SQLite by ID.
 * Deserializes stepResults from JSON string.
 */
export function loadExecution(
	executionId: string,
): WorkflowExecutionState | null {
	const db = getDb();

	const row = db
		.select()
		.from(workflowExecutions)
		.where(eq(workflowExecutions.id, executionId))
		.get();

	if (!row) return null;

	return {
		id: row.id,
		workflowId: row.workflowId,
		status: row.status as WorkflowExecutionState["status"],
		currentStepId: row.currentStepId ?? undefined,
		stepResults: row.stepResults ? JSON.parse(row.stepResults) : {},
		triggeredBy: row.triggeredBy as WorkflowExecutionState["triggeredBy"],
		startedAt: row.startedAt,
		pausedAt: row.pausedAt ?? undefined,
		completedAt: row.completedAt ?? undefined,
		error: row.error ?? undefined,
	};
}

/**
 * List workflow executions with optional filters.
 */
export function listExecutions(
	workflowId?: string,
	status?: string,
): WorkflowExecutionState[] {
	const db = getDb();

	const conditions = [];
	if (workflowId) {
		conditions.push(eq(workflowExecutions.workflowId, workflowId));
	}
	if (status) {
		conditions.push(eq(workflowExecutions.status, status));
	}

	const query = db.select().from(workflowExecutions);

	const rows =
		conditions.length > 0
			? query.where(and(...conditions)).all()
			: query.all();

	return rows.map((row) => ({
		id: row.id,
		workflowId: row.workflowId,
		status: row.status as WorkflowExecutionState["status"],
		currentStepId: row.currentStepId ?? undefined,
		stepResults: row.stepResults ? JSON.parse(row.stepResults) : {},
		triggeredBy: row.triggeredBy as WorkflowExecutionState["triggeredBy"],
		startedAt: row.startedAt,
		pausedAt: row.pausedAt ?? undefined,
		completedAt: row.completedAt ?? undefined,
		error: row.error ?? undefined,
	}));
}

/**
 * Register or update a workflow in the workflows table.
 */
export function registerWorkflow(
	id: string,
	name: string,
	description: string | undefined,
	definitionPath: string,
): void {
	const db = getDb();
	const now = new Date().toISOString();

	db.insert(workflows)
		.values({
			id,
			name,
			description: description ?? null,
			definitionPath,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: workflows.id,
			set: {
				name,
				description: description ?? null,
				definitionPath,
				updatedAt: now,
			},
		})
		.run();
}
