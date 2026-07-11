import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { TimeSchema } from "~/v1/common/schema/TimeSchema";
import { InputRunResolutionSchema } from "~/v1/input/schema/run/InputRunResolutionSchema";
import { LineRunPlanSchema } from "./LineRunPlanSchema";

/**
 * Current line visibility, availability, input readiness, and optional run plan.
 */
export const LineRunResolutionSchema = z
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
		 * Final visibility after show and hide rules are interpreted.
		 */
		show: z.boolean().describe("The final product-line visibility."),
		/**
		 * Final availability after enable and disable rules are interpreted.
		 */
		enable: z.boolean().describe("The final product-line availability."),
		/**
		 * Effective runtime after active runtime multiplier rules are applied.
		 */
		runtimeMs: TimeSchema.describe(
			"The effective runtime after active runtime multiplier rules are applied.",
		),
		/**
		 * Current readiness and optional operation of every configured input.
		 */
		input: z
			.tuple(
				[
					InputRunResolutionSchema,
				],
				InputRunResolutionSchema,
			)
			.describe("The current readiness and optional operation of every configured input."),
		/**
		 * Whether the line is enabled and every implemented input is ready.
		 */
		ready: z
			.boolean()
			.describe("Whether the line is enabled and every implemented input is ready."),
		/**
		 * Exact snapshot-derived run plan when the line is ready.
		 */
		plan: LineRunPlanSchema.optional().describe(
			"The exact snapshot-derived run plan, omitted while the line is not ready.",
		),
	})
	.strict()
	.meta({
		id: "LineRunResolutionSchema",
		description:
			"The current visibility, availability, input readiness, and optional plan of one product line.",
	});

export type LineRunResolutionSchema = typeof LineRunResolutionSchema;

export namespace LineRunResolutionSchema {
	export type Type = z.infer<LineRunResolutionSchema>;
}
