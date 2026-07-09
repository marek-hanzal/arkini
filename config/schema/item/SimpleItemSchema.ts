import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item with no specialized gameplay behavior.
 */
export const SimpleItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"simple",
		]),
	})
	.strict()
	.describe("An item without specialized gameplay behavior.");

export type SimpleItemSchema = typeof SimpleItemSchema;

export namespace SimpleItemSchema {
	export type Type = z.infer<SimpleItemSchema>;
}
