import { z } from "zod";
import { TimeSchema } from "~/game-value/schema/TimeSchema";
import { RuleSchema } from "~/production-action/schema/RuleSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";

/** Optional periodic production admission and active-time lifetime of an owner. */
export const ItemScheduleSchema = z
	.object({
		intervalMs: TimeSchema.min(100)
			.optional()
			.describe(
				"Optional active milliseconds between attempts to enqueue the effective Clock line; omission creates no pulses.",
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
	.refine(({ intervalMs, durationMs }) => intervalMs !== undefined || durationMs !== undefined, {
		message: "Clock requires an interval or a lifetime.",
		path: [
			"durationMs",
		],
	})
	.meta({
		id: "ItemScheduleSchema",
		anyOf: [
			{
				required: [
					"intervalMs",
				],
			},
			{
				required: [
					"durationMs",
				],
			},
		],
		description:
			"Clock-line admission, finite lifetime, or both, with availability rules and expiry output.",
	});
export type ItemScheduleSchema = typeof ItemScheduleSchema;
export namespace ItemScheduleSchema {
	export type Type = z.infer<ItemScheduleSchema>;
}
