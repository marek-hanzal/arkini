import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/** Exact charge payment prepared for one line-input run. */
export const InputChargeRunPlanSchema = z
	.object({
		itemId: IdSchema.describe("The stable runtime item identity that pays this charge cost."),
		cost: PositiveIntegerSchema.describe("The positive charge cost paid by this runtime item."),
	})
	.strict()
	.meta({
		id: "InputChargeRunPlanSchema",
		description: "One exact runtime item and positive charge cost paid by a line input.",
	});

export type InputChargeRunPlanSchema = typeof InputChargeRunPlanSchema;

export namespace InputChargeRunPlanSchema {
	export type Type = z.infer<InputChargeRunPlanSchema>;
}
