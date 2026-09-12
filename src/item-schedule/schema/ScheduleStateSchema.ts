import { IdSchema } from "~/game-value/schema/IdSchema";
import { z } from "zod";
import { TimeSchema } from "~/game-value/schema/TimeSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/** Save-backed phase and lifetime; zero lifetime closes admission while production drains. */
export const ScheduleStateSchema = z
	.object({
		lineId: IdSchema.nullable().optional(),
		remainingIntervalMs: PositiveIntegerSchema.optional(),
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
