import { z } from "zod";

import { ChargeSchema } from "./ChargeSchema";

/** Fields shared by immediate-action and product-line requirements. */
export const BaseSchema = z
	.object({
		/** Optional charge cost paid when the enclosing action commits. */
		charges: ChargeSchema.optional().describe(
			"The optional charge cost paid by the action owner or this requirement's resolved target.",
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
