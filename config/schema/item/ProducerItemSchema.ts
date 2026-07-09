import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemTypeEnumSchema } from "./ItemTypeEnumSchema";

/**
 * An item that will produce gameplay outputs.
 */
export const ProducerItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemTypeEnumSchema.extract([
			"producer",
		]),
	})
	.strict()
	.describe("An item that produces gameplay outputs.");

export type ProducerItemSchema = typeof ProducerItemSchema;

export namespace ProducerItemSchema {
	export type Type = z.infer<ProducerItemSchema>;
}
