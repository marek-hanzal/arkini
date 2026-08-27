import { z } from "zod";

import { InputChargeSchema } from "./InputChargeSchema";

/** Fields shared by immediate-action and product-line requirements. */
export const BaseInputSchema = z
	.object({
		/** Optional charge cost paid when the enclosing action commits. */
		charges: InputChargeSchema.optional().describe(
			"The optional charge cost paid by the action owner or this requirement's resolved target.",
		),
	})
	.strict()
	.meta({
		id: "BaseInputSchema",
		description: "The common fields shared by immediate-action and product-line requirements.",
	});

export type BaseInputSchema = typeof BaseInputSchema;

export namespace BaseInputSchema {
	export type Type = z.infer<BaseInputSchema>;
}
