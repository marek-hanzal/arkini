import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { TimeSchema } from "~/engine/common/schema/TimeSchema";
import { InputRunPlanSchema } from "~/engine/input/schema/run/InputRunPlanSchema";

/**
 * Exact snapshot-derived work prepared for one product-line run.
 *
 * This plan is a read-only preview. A write command must recreate it from the
 * current runtime inside its atomic transaction instead of accepting a stale
 * plan from a caller.
 */
export const LineRunPlanSchema = z
	.object({
		/**
		 * Runtime identity of the item that owns this line.
		 */
		ownerItemId: IdSchema.describe("The runtime item that owns this product line."),
		/**
		 * Stable ID of the configured product line.
		 */
		lineId: IdSchema.describe("The stable ID of the configured product line."),
		/**
		 * Effective runtime after active runtime multiplier rules are applied.
		 */
		runtimeMs: TimeSchema.describe(
			"The effective runtime after active runtime multiplier rules are applied.",
		),
		/**
		 * Exact input operations prepared in configured input order.
		 */
		input: z
			.tuple(
				[
					InputRunPlanSchema,
				],
				InputRunPlanSchema,
			)
			.describe("The exact input operations prepared in configured input order."),
	})
	.strict()
	.meta({
		id: "LineRunPlanSchema",
		description: "The exact snapshot-derived work prepared for one product-line run.",
	});

export type LineRunPlanSchema = typeof LineRunPlanSchema;

export namespace LineRunPlanSchema {
	export type Type = z.infer<LineRunPlanSchema>;
}
