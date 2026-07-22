import { z } from "zod";

import { LineSchema } from "~/engine/line/schema/LineSchema";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item configuration that owns one ordinary product line.
 *
 * Output and placement use the shared line contract. Item lifetime is expressed independently through optional charges.
 */
export const StashItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract(["Stash"]),
		line: LineSchema.describe("The one product line owned by this stash."),
	})
	.strict()
	.meta({
		id: "StashItemSchema",
		description: "An item configuration with one product line.",
	});

export type StashItemSchema = typeof StashItemSchema;

export namespace StashItemSchema {
	export type Type = z.infer<StashItemSchema>;
}
