import { z } from "zod";

import { ChanceSchema } from "./ChanceSchema";
import { GuaranteedSchema } from "./GuaranteedSchema";
import { WeightSchema } from "./WeightSchema";

/**
 * A possible output roll, selected by its `type` discriminator.
 */
export const RollSchema = z
	.discriminatedUnion("type", [
		GuaranteedSchema,
		ChanceSchema,
		WeightSchema,
	])
	.meta({
		id: "RollSchema",
		description: "A typed roll that an output may produce.",
	});

export type RollSchema = typeof RollSchema;

export namespace RollSchema {
	export type Type = z.infer<RollSchema>;
}
