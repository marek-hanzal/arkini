import { z } from "zod";

import { QuantityRangeSchema } from "./QuantityRangeSchema";
import { QuantityValueSchema } from "./QuantityValueSchema";

/**
 * The positive quantity of an item emitted by a drop.
 *
 * A quantity is selected by its explicit `type` discriminator.
 */
export const QuantitySchema = z
	.discriminatedUnion("type", [
		QuantityValueSchema,
		QuantityRangeSchema,
	])
	.meta({
		id: "QuantitySchema",
		description: "A fixed or inclusive range quantity selected by its type.",
	});

export type QuantitySchema = typeof QuantitySchema;

export namespace QuantitySchema {
	export type Type = z.infer<QuantitySchema>;
}
