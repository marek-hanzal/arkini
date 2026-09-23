import { z } from "zod";
import { ItemScheduleExpiryModeSchema } from "~/item-schedule/schema/ItemScheduleExpiryModeSchema";
import { TimeSchema } from "~/game-value/schema/TimeSchema";
import { RuleSchema } from "~/production-action/schema/RuleSchema";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";

/** Optional periodic production admission and active-time lifetime of an owner. */
export const ItemScheduleSchema = z
	.object({
		intervalMs: TimeSchema.min(100)
			.optional()
			.describe(
				"Optional active milliseconds between weighted selections from rule-enabled Clock lines for ordinary queue admission; omission creates no pulses.",
			),
		durationMs: TimeSchema.min(100)
			.optional()
			.describe(
				"Optional active lifetime; expiryMode determines whether accepted work may outlive it.",
			),
		expiryMode: ItemScheduleExpiryModeSchema.optional().describe(
			"Lifetime expiry policy; omission uses loose-kill. Has no effect without a finite duration.",
		),
		enable: z.boolean().default(true),
		rules: z.array(RuleSchema).default([]),
		onExpire: OutcomeTableSchema.optional().describe(
			"Output resolved at owner expiry in both modes; kill-switch places what fits after returned materials and logs the excess as lost, within the same atomic removal.",
		),
	})
	.strict()
	.superRefine(({ intervalMs, durationMs }, context) => {
		if (intervalMs !== undefined || durationMs !== undefined) return;
		for (const field of [
			"intervalMs",
			"durationMs",
		] as const)
			context.addIssue({
				code: "custom",
				message: "Clock requires an interval or a lifetime.",
				path: [
					field,
				],
			});
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
			"Clock-line admission, finite lifetime, or both, with availability rules and expiry outcome.",
	});
export type ItemScheduleSchema = typeof ItemScheduleSchema;
export namespace ItemScheduleSchema {
	export type Type = z.infer<ItemScheduleSchema>;
}
