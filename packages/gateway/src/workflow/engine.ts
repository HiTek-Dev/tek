import { nanoid } from "nanoid";
import { createLogger } from "@tek/core";
import type {
	WorkflowDefinition,
	WorkflowExecutionState,
	StepDefinition,
	StepResult,
} from "./types.js";
import { loadWorkflowDefinition } from "./loader.js";
import { executeStep, resolveNextStep } from "./executor.js";
import { saveExecution, loadExecution } from "./state.js";

const logger = createLogger("workflow-engine");

/**
 * WorkflowEngine orchestrates workflow loading, step execution, and resume.
 *
 * Persists execution state to SQLite after every step transition for
 * durable execution. Supports approval gate pauses with resume capability.
 */
export class WorkflowEngine {
	/**
	 * Execute a workflow from the beginning.
	 */
	async execute(
		workflowId: string,
		definitionPath: string,
		triggeredBy: "manual" | "cron" | "heartbeat",
		tools: Record<string, unknown>,
		onApprovalNeeded?: (
			executionId: string,
			stepId: string,
			step: StepDefinition,
		) => void,
	): Promise<WorkflowExecutionState> {
		const definition = await loadWorkflowDefinition(definitionPath);

		const execution: WorkflowExecutionState = {
			id: nanoid(),
			workflowId,
			status: "running",
			stepResults: {},
			startedAt: new Date().toISOString(),
			triggeredBy,
		};

		saveExecution(execution);
		logger.info(
			`Starting workflow ${workflowId} (execution: ${execution.id})`,
		);

		return this.runSteps(
			execution,
			definition,
			tools,
			onApprovalNeeded,
		);
	}

	/**
	 * Resume a paused workflow execution.
	 *
	 * Loads the execution state from DB, marks the paused step as approved,
	 * and continues execution from the step after the paused one.
	 */
	async resume(
		executionId: string,
		tools: Record<string, unknown>,
		onApprovalNeeded?: (
			executionId: string,
			stepId: string,
			step: StepDefinition,
		) => void,
	): Promise<WorkflowExecutionState> {
		const execution = loadExecution(executionId);
		if (!execution) {
			throw new Error(`Execution ${executionId} not found`);
		}

		if (execution.status !== "paused") {
			throw new Error(
				`Execution ${executionId} is not paused (status: ${execution.status})`,
			);
		}

		// Mark the paused step as approved by setting its status to success
		if (execution.currentStepId) {
			const pausedResult = execution.stepResults[execution.currentStepId];
			if (pausedResult && pausedResult.status === "paused") {
				execution.stepResults[execution.currentStepId] = {
					...pausedResult,
					status: "success",
					completedAt: new Date().toISOString(),
				};
			}
		}

		execution.status = "running";
		execution.pausedAt = undefined;
		saveExecution(execution);

		logger.info(`Resuming workflow execution: ${executionId}`);

		// Load the definition to get the steps
		// We need to find which workflow this execution belongs to
		// The workflowId maps to a workflow record that has the definition path
		const { getDb, workflows } = await import("@tek/db");
		const { eq } = await import("drizzle-orm");
		const db = getDb();
		const workflow = db
			.select()
			.from(workflows)
			.where(eq(workflows.id, execution.workflowId))
			.get();

		if (!workflow) {
			throw new Error(
				`Workflow ${execution.workflowId} not found in DB`,
			);
		}

		const definition = await loadWorkflowDefinition(
			workflow.definitionPath,
		);

		return this.runSteps(
			execution,
			definition,
			tools,
			onApprovalNeeded,
		);
	}

	/**
	 * Run steps starting from the current position in the execution.
	 *
	 * Persists state after every step transition for durability.
	 * Pauses at approval gates and invokes the onApprovalNeeded callback.
	 */
	private async runSteps(
		execution: WorkflowExecutionState,
		definition: WorkflowDefinition,
		tools: Record<string, unknown>,
		onApprovalNeeded?: (
			executionId: string,
			stepId: string,
			step: StepDefinition,
		) => void,
	): Promise<WorkflowExecutionState> {
		const steps = definition.steps;

		// Find starting step
		let stepIndex: number;
		if (execution.currentStepId) {
			const currentIdx = steps.findIndex(
				(s) => s.id === execution.currentStepId,
			);
			// Start from the step after the current one (which was just completed/approved)
			stepIndex = currentIdx >= 0 ? currentIdx + 1 : 0;
		} else {
			stepIndex = 0;
		}

		try {
			while (stepIndex < steps.length) {
				const step = steps[stepIndex];
				execution.currentStepId = step.id;

				// Check approval gate
				if (
					step.approvalRequired &&
					!this.isStepApproved(execution, step.id)
				) {
					execution.status = "paused";
					execution.pausedAt = new Date().toISOString();
					execution.stepResults[step.id] = {
						status: "paused",
						output: null,
					};
					saveExecution(execution);

					logger.info(
						`Workflow ${execution.workflowId} paused at step ${step.id} (approval required)`,
					);

					if (onApprovalNeeded) {
						onApprovalNeeded(execution.id, step.id, step);
					}

					return execution;
				}

				// Execute the step
				const result = await executeStep(step, {
					steps: execution.stepResults,
					tools,
					error: execution.error,
				});

				// Store result
				execution.stepResults[step.id] = result;
				saveExecution(execution);

				logger.info(
					`Step ${step.id} completed (status: ${result.status})`,
				);

				// Resolve next step
				const nextStepId = resolveNextStep(step, result, steps);

				if (nextStepId) {
					// Jump to specific step
					const nextIdx = steps.findIndex(
						(s) => s.id === nextStepId,
					);
					if (nextIdx < 0) {
						throw new Error(
							`Step ${step.id} branched to unknown step: ${nextStepId}`,
						);
					}
					stepIndex = nextIdx;
				} else {
					// Advance to next step by index
					stepIndex++;
				}
			}

			// All steps completed
			execution.status = "completed";
			execution.completedAt = new Date().toISOString();
			execution.currentStepId = undefined;
			saveExecution(execution);

			logger.info(
				`Workflow ${execution.workflowId} completed (execution: ${execution.id})`,
			);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : String(err);
			execution.status = "failed";
			execution.error = message;
			saveExecution(execution);

			logger.info(
				`Workflow ${execution.workflowId} failed: ${message}`,
			);
		}

		return execution;
	}

	/**
	 * Check if a step has already been approved (its result is success).
	 */
	private isStepApproved(
		execution: WorkflowExecutionState,
		stepId: string,
	): boolean {
		const result = execution.stepResults[stepId];
		return result?.status === "success";
	}
}

/** Singleton workflow engine instance. */
export const workflowEngine = new WorkflowEngine();
