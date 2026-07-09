import { z } from "zod";

import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item with no specialized gameplay behavior.
 */
export const SimpleItemSchema = z
	.object({
		...BaseItemSchema.shape,
		/**
		 * Maximum number of this item that one inventory stack can hold.
		 */
		maxStackSize: PositiveIntegerSchema.describe(
			"The maximum number of this simple item that one inventory stack can hold.",
		),
		/**
		 * Identifies this item as a simple stackable item.
		 */
		type: ItemEnumSchema.extract([
			"simple",
		]),
	})
	.strict()
	.meta({
		id: "SimpleItemSchema",
		description: "A stackable item without specialized gameplay behavior.",
	});

export type SimpleItemSchema = typeof SimpleItemSchema;

export namespace SimpleItemSchema {
	export type Type = z.infer<SimpleItemSchema>;
}
