import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item that will produce gameplay outputs.
 */
export const ProducerItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"producer",
		]),
	})
	.strict()
	.describe("An item that produces gameplay outputs.");

export type ProducerItemSchema = typeof ProducerItemSchema;

export namespace ProducerItemSchema {
	export type Type = z.infer<ProducerItemSchema>;
}
