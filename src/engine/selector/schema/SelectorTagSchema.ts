import { z } from "zod";

import { TagSchema } from "~/engine/tag/schema/TagSchema";

import { BaseSelectorSchema } from "./BaseSelectorSchema";
import { SelectorEnumSchema } from "./SelectorEnumSchema";

/**
 * Selects every canonical game item classified with one semantic tag.
 */
export const SelectorTagSchema = z
	.object({
		...BaseSelectorSchema.shape,
		/**
		 * Identifies this selector as an item-tag selector.
		 */
		type: SelectorEnumSchema.extract([
			"Tag",
		]).describe("Identifies this selector as an item-tag selector."),
		/**
		 * Semantic tag shared by every canonical item selected by this selector.
		 */
		tag: TagSchema.describe(
			"The semantic tag shared by every canonical item selected by this selector.",
		),
	})
	.strict()
	.meta({
		id: "SelectorTagSchema",
		description: "A selector that chooses every canonical game item with one semantic tag.",
	});

export type SelectorTagSchema = typeof SelectorTagSchema;

export namespace SelectorTagSchema {
	export type Type = z.infer<SelectorTagSchema>;
}
