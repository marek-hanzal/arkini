import { z } from "zod";

import { SelectorItemSchema } from "./SelectorItemSchema";
import { SelectorTagSchema } from "./SelectorTagSchema";

/**
 * A discriminated item selector that resolves to one or more canonical items.
 *
 * Each selector member owns its matching strategy and fields. The `type`
 * discriminator keeps consumers explicit and directly compatible with
 * `ts-pattern`.
 */
export const SelectorSchema = z
	.discriminatedUnion("type", [
		SelectorItemSchema,
		SelectorTagSchema,
	])
	.meta({
		id: "SelectorSchema",
		description: "A selector that resolves to one or more canonical game items.",
	});

export type SelectorSchema = typeof SelectorSchema;

export namespace SelectorSchema {
	export type Type = z.infer<SelectorSchema>;
}
