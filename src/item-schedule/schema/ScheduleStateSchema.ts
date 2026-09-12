import { z } from "zod";
import { TimeSchema } from "~/game-value/schema/TimeSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/** Save-backed phase and lifetime; zero lifetime closes admission while production drains. */
export const ScheduleStateSchema = z
	.object({
		running: z.boolean(),
		remainingIntervalMs: PositiveIntegerSchema,
		remainingDurationMs: TimeSchema.optional(),
	})
	.strict()
	.meta({
		id: "ScheduleStateSchema",
	});
export type ScheduleStateSchema = typeof ScheduleStateSchema;
export namespace ScheduleStateSchema {
	export type Type = z.infer<ScheduleStateSchema>;
}
