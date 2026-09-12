import { z } from "zod";

import { UnitCostSchema } from "./UnitCostSchema";

/** Fields shared by immediate-action and product-line requirements. */
export const BaseSchema = z
	.object({
		/** Optional unit cost paid when the enclosing action commits. */
		units: UnitCostSchema.optional().describe(
			"The optional unit cost paid by the action owner or this requirement's resolved target.",
		),
	})
	.strict()
	.meta({
		id: "input.BaseSchema",
		description: "The common fields shared by immediate-action and product-line requirements.",
	});

export type BaseSchema = typeof BaseSchema;

export namespace BaseSchema {
	export type Type = z.infer<BaseSchema>;
}
