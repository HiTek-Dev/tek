import { z } from "zod";

export const ActiveHoursSchema = z.object({
	start: z.string(),
	end: z.string(),
	daysOfWeek: z.array(z.number()).optional(),
});

export const ScheduleConfigSchema = z.object({
	id: z.string(),
	name: z.string(),
	cronExpression: z.string(),
	timezone: z.string().optional(),
	activeHours: ActiveHoursSchema.optional(),
	maxRuns: z.number().optional(),
	workflowId: z.string().optional(),
	enabled: z.boolean().default(true),
});

export const HeartbeatConfigSchema = z.object({
	interval: z.number().default(30),
	timezone: z.string().optional(),
	activeHours: ActiveHoursSchema.optional(),
});

export type ActiveHours = z.infer<typeof ActiveHoursSchema>;
export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;
export type HeartbeatConfig = z.infer<typeof HeartbeatConfigSchema>;
