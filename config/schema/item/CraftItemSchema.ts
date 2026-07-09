import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";
import { LineSchema } from "../line/LineSchema";

/**
 * An item that provides a single craft product line.
 *
 * A craft owns one product line instead of a producer's multiple selectable
 * product lines.
 */
export const CraftItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"craft",
		]),
		/**
		 * The one product line owned by this craft.
		 */
		line: LineSchema.describe("The one product line owned by this craft."),
	})
	.strict()
	.describe("An item that provides a single craft product line.");

export type CraftItemSchema = typeof CraftItemSchema;

export namespace CraftItemSchema {
	export type Type = z.infer<CraftItemSchema>;
}
