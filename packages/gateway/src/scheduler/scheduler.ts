import { Cron } from "croner";
import type { LanguageModel } from "ai";
import { createLogger } from "@tek/core";
import { workflowEngine } from "../workflow/engine.js";
import { HeartbeatRunner } from "./heartbeat.js";
import type { HeartbeatCheckResult } from "./heartbeat.js";
import { loadSchedules } from "./store.js";
import type { ScheduleConfig, ActiveHours } from "./types.js";

const logger = createLogger("cron-scheduler");

/**
 * Check if the current time falls within the configured active hours window.
 *
 * Active hours define a time-of-day window and optional days-of-week filter.
 * Days use ISO format: Monday=1 through Sunday=7.
 */
export function isWithinActiveHours(hours: ActiveHours): boolean {
	const now = new Date();

	// Check day-of-week if defined
	if (hours.daysOfWeek && hours.daysOfWeek.length > 0) {
		// Convert JS Sunday=0 to ISO Monday=1..Sunday=7
		const jsDay = now.getDay();
		const isoDay = jsDay === 0 ? 7 : jsDay;
		if (!hours.daysOfWeek.includes(isoDay)) {
			return false;
		}
	}

	// Parse start/end as HH:MM and compare against current time in minutes
	const currentMinutes = now.getHours() * 60 + now.getMinutes();
	const [startH, startM] = hours.start.split(":").map(Number);
	const [endH, endM] = hours.end.split(":").map(Number);
	const startMinutes = startH * 60 + startM;
	const endMinutes = endH * 60 + endM;

	// Handle overnight ranges (e.g., 22:00 - 06:00)
	if (startMinutes <= endMinutes) {
		return currentMinutes >= startMinutes && currentMinutes < endMinutes;
	}
	return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

/**
 * CronScheduler manages Croner-based cron jobs with active hours filtering,
 * SQLite persistence, heartbeat scheduling with overlap prevention,
 * and full lifecycle management (schedule/pause/resume/stop/reload).
 */
export class CronScheduler {
	private jobs = new Map<string, Cron>();

	/**
	 * Schedule a cron job with the given configuration and handler.
	 *
	 * Applies active hours guard: if configured, the handler is skipped
	 * (with a log message) when outside the active window.
	 */
	schedule(config: ScheduleConfig, handler: () => Promise<void>): void {
		const job = new Cron(
			config.cronExpression,
			{
				timezone: config.timezone,
				maxRuns: config.maxRuns,
				paused: !config.enabled,
				name: config.id,
				catch: (err: unknown) => {
					const message =
						err instanceof Error ? err.message : String(err);
					logger.info(
						`Cron job ${config.id} error: ${message}`,
					);
				},
			},
			async () => {
				// Active hours guard
				if (config.activeHours) {
					if (!isWithinActiveHours(config.activeHours)) {
						logger.info(
							`Cron job ${config.id} skipped: outside active hours`,
						);
						return;
					}
				}

				await handler();
			},
		);

		this.jobs.set(config.id, job);
		logger.info(
			`Scheduled cron job: ${config.id} (${config.cronExpression})`,
		);
	}

	/**
	 * Schedule a workflow execution as a cron job.
	 * Only applicable if config.workflowId is set.
	 */
	scheduleWorkflow(
		config: ScheduleConfig,
		tools: Record<string, unknown>,
	): void {
		if (!config.workflowId) {
			logger.info(
				`Cannot schedule workflow for ${config.id}: no workflowId`,
			);
			return;
		}

		const workflowId = config.workflowId;
		this.schedule(config, async () => {
			logger.info(
				`Cron trigger: executing workflow ${workflowId}`,
			);
			await workflowEngine.execute(
				workflowId,
				"", // definition path resolved by engine from DB
				"cron",
				tools,
			);
		});
	}

	/**
	 * Schedule a heartbeat check as a cron job with overlap prevention.
	 *
	 * Uses Croner's protect option to prevent overlapping runs.
	 * Calls onAlert when any checklist item requires action.
	 */
	scheduleHeartbeat(
		config: ScheduleConfig,
		heartbeatPath: string,
		tools: Record<string, unknown>,
		model: LanguageModel,
		onAlert: (results: HeartbeatCheckResult[]) => void,
	): void {
		const runner = new HeartbeatRunner(heartbeatPath);

		const job = new Cron(
			config.cronExpression,
			{
				timezone: config.timezone,
				maxRuns: config.maxRuns,
				paused: !config.enabled,
				name: config.id,
				protect: true, // Prevent overlapping heartbeat runs
				catch: (err: unknown) => {
					const message =
						err instanceof Error ? err.message : String(err);
					logger.info(
						`Heartbeat ${config.id} error: ${message}`,
					);
				},
			},
			async () => {
				// Active hours guard
				if (config.activeHours) {
					if (!isWithinActiveHours(config.activeHours)) {
						logger.info(
							`Heartbeat ${config.id} skipped: outside active hours`,
						);
						return;
					}
				}

				logger.info(`Running heartbeat: ${config.id}`);
				const results = await runner.run(tools, model);
				const actionItems = results.filter((r) => r.actionNeeded);

				if (actionItems.length > 0) {
					logger.info(
						`Heartbeat ${config.id}: ${actionItems.length} item(s) need action`,
					);
					onAlert(actionItems);
				} else {
					logger.info(
						`Heartbeat ${config.id}: all checks passed`,
					);
				}
			},
		);

		this.jobs.set(config.id, job);
		logger.info(
			`Scheduled heartbeat: ${config.id} (${config.cronExpression}, protect=true)`,
		);
	}

	/**
	 * Pause a running cron job.
	 */
	pause(id: string): void {
		const job = this.jobs.get(id);
		if (job) {
			job.pause();
			logger.info(`Paused cron job: ${id}`);
		}
	}

	/**
	 * Resume a paused cron job.
	 */
	resume(id: string): void {
		const job = this.jobs.get(id);
		if (job) {
			job.resume();
			logger.info(`Resumed cron job: ${id}`);
		}
	}

	/**
	 * Stop and remove a cron job.
	 */
	stop(id: string): void {
		const job = this.jobs.get(id);
		if (job) {
			job.stop();
			this.jobs.delete(id);
			logger.info(`Stopped cron job: ${id}`);
		}
	}

	/**
	 * Stop all cron jobs and clear the job map.
	 */
	stopAll(): void {
		for (const [id, job] of this.jobs) {
			job.stop();
			logger.info(`Stopped cron job: ${id}`);
		}
		this.jobs.clear();
	}

	/**
	 * Get the next scheduled run time for a job.
	 */
	nextRun(id: string): Date | null {
		const job = this.jobs.get(id);
		return job?.nextRun() ?? null;
	}

	/**
	 * List all active jobs with their next run times.
	 */
	listActive(): Array<{ id: string; nextRun: Date | null }> {
		const active: Array<{ id: string; nextRun: Date | null }> = [];
		for (const [id, job] of this.jobs) {
			active.push({ id, nextRun: job.nextRun() ?? null });
		}
		return active;
	}

	/**
	 * Reload all schedules from SQLite.
	 *
	 * Stops all existing jobs, loads enabled schedules from the store,
	 * and re-creates Croner jobs for each. Optionally schedules heartbeat.
	 */
	async reload(
		tools: Record<string, unknown>,
		model?: LanguageModel,
		heartbeatPath?: string,
		onAlert?: (results: HeartbeatCheckResult[]) => void,
	): Promise<void> {
		this.stopAll();

		const configs = loadSchedules(true);
		for (const config of configs) {
			if (config.workflowId) {
				this.scheduleWorkflow(config, tools);
			}
		}

		if (heartbeatPath && model && onAlert) {
			// Find or create a heartbeat schedule config
			const heartbeatConfig = configs.find(
				(c) => !c.workflowId,
			);
			if (heartbeatConfig) {
				this.scheduleHeartbeat(
					heartbeatConfig,
					heartbeatPath,
					tools,
					model,
					onAlert,
				);
			}
		}

		logger.info(
			`Reloaded ${configs.length} schedule(s) from store`,
		);
	}
}

/** Singleton cron scheduler instance. */
export const cronScheduler = new CronScheduler();
