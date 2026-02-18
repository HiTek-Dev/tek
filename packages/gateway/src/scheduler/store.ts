import { getDb, schedules } from "@tek/db";
import { eq } from "drizzle-orm";
import type { ScheduleConfig } from "./types.js";

/**
 * Save a new schedule configuration to SQLite.
 */
export function saveSchedule(config: ScheduleConfig): void {
	const db = getDb();
	const now = new Date().toISOString();

	db.insert(schedules)
		.values({
			id: config.id,
			name: config.name,
			cronExpression: config.cronExpression,
			timezone: config.timezone ?? null,
			activeHoursStart: config.activeHours?.start ?? null,
			activeHoursEnd: config.activeHours?.end ?? null,
			activeHoursDays: config.activeHours?.daysOfWeek
				? JSON.stringify(config.activeHours.daysOfWeek)
				: null,
			maxRuns: config.maxRuns ?? null,
			workflowId: config.workflowId ?? null,
			enabled: config.enabled,
			lastRunAt: null,
			createdAt: now,
			updatedAt: now,
		})
		.run();
}

/**
 * Load schedules from SQLite, optionally filtering to enabled only.
 */
export function loadSchedules(enabledOnly?: boolean): ScheduleConfig[] {
	const db = getDb();

	const rows = enabledOnly
		? db.select().from(schedules).where(eq(schedules.enabled, true)).all()
		: db.select().from(schedules).all();

	return rows.map(rowToConfig);
}

/**
 * Get a single schedule by ID.
 */
export function getSchedule(id: string): ScheduleConfig | null {
	const db = getDb();
	const row = db
		.select()
		.from(schedules)
		.where(eq(schedules.id, id))
		.get();

	return row ? rowToConfig(row) : null;
}

/**
 * Partially update a schedule configuration.
 */
export function updateSchedule(
	id: string,
	updates: Partial<
		Pick<
			ScheduleConfig,
			"cronExpression" | "timezone" | "activeHours" | "maxRuns" | "enabled"
		>
	>,
): void {
	const db = getDb();
	const now = new Date().toISOString();

	const values: Record<string, unknown> = { updatedAt: now };

	if (updates.cronExpression !== undefined) {
		values.cronExpression = updates.cronExpression;
	}
	if (updates.timezone !== undefined) {
		values.timezone = updates.timezone;
	}
	if (updates.activeHours !== undefined) {
		values.activeHoursStart = updates.activeHours.start;
		values.activeHoursEnd = updates.activeHours.end;
		values.activeHoursDays = updates.activeHours.daysOfWeek
			? JSON.stringify(updates.activeHours.daysOfWeek)
			: null;
	}
	if (updates.maxRuns !== undefined) {
		values.maxRuns = updates.maxRuns;
	}
	if (updates.enabled !== undefined) {
		values.enabled = updates.enabled;
	}

	db.update(schedules).set(values).where(eq(schedules.id, id)).run();
}

/**
 * Delete a schedule from SQLite.
 */
export function deleteSchedule(id: string): void {
	const db = getDb();
	db.delete(schedules).where(eq(schedules.id, id)).run();
}

/**
 * Map a database row to a ScheduleConfig object.
 */
function rowToConfig(row: typeof schedules.$inferSelect): ScheduleConfig {
	const config: ScheduleConfig = {
		id: row.id,
		name: row.name,
		cronExpression: row.cronExpression,
		enabled: row.enabled,
	};

	if (row.timezone) {
		config.timezone = row.timezone;
	}
	if (row.maxRuns != null) {
		config.maxRuns = row.maxRuns;
	}
	if (row.workflowId) {
		config.workflowId = row.workflowId;
	}
	if (row.activeHoursStart && row.activeHoursEnd) {
		config.activeHours = {
			start: row.activeHoursStart,
			end: row.activeHoursEnd,
			daysOfWeek: row.activeHoursDays
				? (JSON.parse(row.activeHoursDays) as number[])
				: undefined,
		};
	}

	return config;
}
