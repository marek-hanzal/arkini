import { z } from "zod";

import { RollChanceSchema } from "./RollChanceSchema";
import { RollGuaranteedSchema } from "./RollGuaranteedSchema";
import { RollWeightSchema } from "./RollWeightSchema";

/**
 * A possible output roll, selected by its `type` discriminator.
 */
export const RollSchema = z
	.discriminatedUnion("type", [
		RollGuaranteedSchema,
		RollChanceSchema,
		RollWeightSchema,
	])
	.meta({
		id: "RollSchema",
		description: "A typed roll that an output may produce.",
	});

export type RollSchema = typeof RollSchema;

export namespace RollSchema {
	export type Type = z.infer<RollSchema>;
}
