import { z } from "zod";

import { UnitsSchema } from "./UnitsSchema";
import { MaterialSchema } from "./MaterialSchema";
import { SimpleSchema } from "./SimpleSchema";

/**
 * A discriminated resource requirement for one product line.
 *
 * Simple inputs carry no resource operation. Material inputs are directly
 * delivered items. Units inputs resolve a matching Board item and spend its
 * units in place through the shared action settlement.
 */
export const InputSchema = z
	.discriminatedUnion("type", [
		SimpleSchema,
		MaterialSchema,
		UnitsSchema,
	])
	.meta({
		id: "InputSchema",
		description:
			"A simple, material-item, or Board unit-cost input requirement for a product line.",
	});

export type InputSchema = typeof InputSchema;

export namespace InputSchema {
	export type Type = z.infer<InputSchema>;
}
