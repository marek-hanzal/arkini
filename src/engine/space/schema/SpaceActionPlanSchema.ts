import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { InputChargeRunPlanSchema } from "~/engine/input/schema/run/InputChargeRunPlanSchema";

/** Immutable requirements reserved for one immediate Space activation. */
export const SpaceActionPlanSchema = z
	.object({
		ownerItemId: IdSchema,
		space: NonNegativeIntegerSchema,
		charges: z.array(InputChargeRunPlanSchema),
	})
	.strict()
	.meta({
		id: "SpaceActionPlanSchema",
		description: "The exact charge settlement and target of one Space action.",
	});

export type SpaceActionPlanSchema = typeof SpaceActionPlanSchema;

export namespace SpaceActionPlanSchema {
	export type Type = z.infer<SpaceActionPlanSchema>;
}
