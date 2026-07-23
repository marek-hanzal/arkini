import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

import { BaseQuantitySchema } from "./BaseQuantitySchema";
import { QuantityEnumSchema } from "./QuantityEnumSchema";

/**
 * A fixed positive quantity emitted by an item drop.
 */
export const QuantityValueSchema = z
	.object({
		...BaseQuantitySchema.shape,
		type: QuantityEnumSchema.extract([
			"Value",
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
