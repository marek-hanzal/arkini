import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { BaseSelectorSchema } from "./BaseSelectorSchema";
import { SelectorEnumSchema } from "./SelectorEnumSchema";

/**
 * Selects one canonical game item by its stable ID.
 */
export const SelectorItemSchema = z
	.object({
		...BaseSelectorSchema.shape,
		/**
		 * Identifies this selector as a direct item-ID selector.
		 */
		type: SelectorEnumSchema.extract([
			"item",
		]).describe("Identifies this selector as a direct item-ID selector."),
		/**
		 * Stable ID of the one canonical item selected by this selector.
		 */
		itemId: IdSchema.describe(
			"The stable ID of the one canonical item selected by this selector.",
		),
	})
	.strict()
	.describe("A selector that chooses one canonical game item by its stable ID.");

export type SelectorItemSchema = typeof SelectorItemSchema;

export namespace SelectorItemSchema {
	export type Type = z.infer<SelectorItemSchema>;
}
