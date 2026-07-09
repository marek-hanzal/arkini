import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";
import { LineSchema } from "../line/LineSchema";

/**
 * An item that provides one or more selectable product lines.
 */
export const ProducerItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"producer",
		]),
		/**
		 * One or more product lines provided by this producer.
		 */
		lines: z
			.tuple(
				[
					LineSchema,
				],
				LineSchema,
			)
			.describe("One or more product lines provided by this producer."),
	})
	.strict()
	.describe("An item that provides one or more selectable product lines.");

export type ProducerItemSchema = typeof ProducerItemSchema;

export namespace ProducerItemSchema {
	export type Type = z.infer<ProducerItemSchema>;
}
