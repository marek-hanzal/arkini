import { z } from "zod";
import { TimeSchema } from "~/game-value/schema/TimeSchema";
import { RuleSchema } from "~/production-action/schema/RuleSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";

/** Periodic production admission and optional active-time lifetime of an owner. */
export const ItemScheduleSchema = z
	.object({
		intervalMs: TimeSchema.min(100).describe(
			"Active milliseconds between attempts to enqueue the effective Clock line.",
		),
		durationMs: TimeSchema.min(100)
			.optional()
			.describe("Optional active lifetime; accepted work can outlive the schedule."),
		enable: z.boolean().default(true),
		rules: z.array(RuleSchema).default([]),
		onExpire: OutputSchema.optional().describe(
			"Output emitted atomically when the expired owner finishes settling production.",
		),
	})
	.strict()
	.meta({
		id: "ItemScheduleSchema",
		description:
			"Periodic Clock-line admission with optional active lifetime, availability rules and expiry output.",
	});
export type ItemScheduleSchema = typeof ItemScheduleSchema;
export namespace ItemScheduleSchema {
	export type Type = z.infer<ItemScheduleSchema>;
}
