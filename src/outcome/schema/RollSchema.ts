import { z } from "zod";

import { ChanceRollSchema } from "./ChanceRollSchema";
import { GuaranteedRollSchema } from "./GuaranteedRollSchema";

/**
 * A possible outcome roll, selected by its `type` discriminator.
 */
export const RollSchema = z
	.discriminatedUnion("type", [
		GuaranteedRollSchema,
		ChanceRollSchema,
	])
	.meta({
		id: "RollSchema",
		description: "A typed roll that an outcome may produce.",
	});

export type RollSchema = typeof RollSchema;

export namespace RollSchema {
	export type Type = z.infer<RollSchema>;
}
