import { z } from "zod";

import { InputChargeSchema } from "./InputChargeSchema";

/** Fields shared by every product-line input requirement. */
export const BaseInputSchema = z
	.object({
		/** Optional charge cost paid when this input starts one actual job. */
		charges: InputChargeSchema.optional().describe(
			"The optional charge cost paid by the line owner or this input's resolved target.",
		),
	})
	.strict()
	.meta({
		id: "BaseInputSchema",
		description: "The common fields shared by every product-line input requirement.",
	});

export type BaseInputSchema = typeof BaseInputSchema;

export namespace BaseInputSchema {
	export type Type = z.infer<BaseInputSchema>;
}
