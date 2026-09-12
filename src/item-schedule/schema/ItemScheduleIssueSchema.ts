import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

/** Scheduling state must match its authored capability and stay on its Board identity. */
export const ItemScheduleIssueSchema = z
	.object({
		type: RuntimeCheckIssueEnumSchema.extract([
			"ItemSchedule",
		]),
		itemId: IdSchema,
		reason: z.enum([
			"unexpected-state",
			"missing-state",
			"invalid-phase",
			"invalid-line",
			"invalid-lifetime",
			"invalid-location",
		]),
	})
	.strict()
	.meta({
		id: "ItemScheduleIssueSchema",
	});
export type ItemScheduleIssueSchema = typeof ItemScheduleIssueSchema;
export namespace ItemScheduleIssueSchema {
	export type Type = z.infer<ItemScheduleIssueSchema>;
}
