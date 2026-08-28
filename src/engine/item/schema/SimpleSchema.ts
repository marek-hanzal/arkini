import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * An item with no specialized gameplay behavior.
 */
export const SimpleSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this item as a simple stackable item.
		 */
		type: TypeSchema.extract([
			"Simple",
		]),
	})
	.strict()
	.meta({
		id: "item.SimpleSchema",
		description: "An item without specialized gameplay behavior.",
	});

export type SimpleSchema = typeof SimpleSchema;

export namespace SimpleSchema {
	export type Type = z.infer<SimpleSchema>;
}
