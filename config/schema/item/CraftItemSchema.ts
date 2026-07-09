import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemTypeEnumSchema } from "./ItemTypeEnumSchema";

/**
 * An item that will provide crafting gameplay behavior.
 */
export const CraftItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemTypeEnumSchema.extract([
			"craft",
		]),
	})
	.strict()
	.describe("An item that provides crafting gameplay behavior.");

export type CraftItemSchema = typeof CraftItemSchema;

export namespace CraftItemSchema {
	export type Type = z.infer<CraftItemSchema>;
}
