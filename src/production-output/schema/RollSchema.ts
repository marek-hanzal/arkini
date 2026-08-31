import { z } from "zod";

import { ChanceRollSchema } from "./ChanceRollSchema";
import { GuaranteedRollSchema } from "./GuaranteedRollSchema";
import { WeightedRollSchema } from "./WeightedRollSchema";

/**
 * A possible output roll, selected by its `type` discriminator.
 */
export const RollSchema = z
	.discriminatedUnion("type", [
		GuaranteedRollSchema,
		ChanceRollSchema,
		WeightedRollSchema,
	])
	.meta({
		id: "RollSchema",
		description: "A typed roll that an output may produce.",
	});

export type RollSchema = typeof RollSchema;

export namespace RollSchema {
	export type Type = z.infer<RollSchema>;
}
