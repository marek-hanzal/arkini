import { z } from "zod";

/**
 * Discriminates the strategy used to select game items.
 */
export const SelectorEnumSchema = z
	.enum({
		Item: "item",
		Tag: "tag",
	})
	.meta({
		id: "SelectorEnumSchema",
		description: "The strategy used to select game items.",
	});

export type SelectorEnumSchema = typeof SelectorEnumSchema;

export namespace SelectorEnumSchema {
	export type Type = z.infer<SelectorEnumSchema>;
}
