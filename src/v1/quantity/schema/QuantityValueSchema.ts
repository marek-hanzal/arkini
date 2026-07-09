import { z } from "zod";

import { BaseQuantitySchema } from "./BaseQuantitySchema";
import { QuantityEnumSchema } from "./QuantityEnumSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/**
 * A fixed positive quantity emitted by an item drop.
 */
export const QuantityValueSchema = z
	.object({
		...BaseQuantitySchema.shape,
		type: QuantityEnumSchema.extract([
			"value",
		]),
		/**
		 * Fixed number of items emitted by the drop.
		 */
		value: PositiveIntegerSchema.describe("The fixed positive quantity emitted by the drop."),
	})
	.strict()
	.meta({
		id: "QuantityValueSchema",
		description: "A fixed positive quantity emitted by an item drop.",
	});

export type QuantityValueSchema = typeof QuantityValueSchema;

export namespace QuantityValueSchema {
	export type Type = z.infer<QuantityValueSchema>;
}
