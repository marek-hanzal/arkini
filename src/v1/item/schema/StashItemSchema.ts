import { z } from "zod";
import { LineSchema } from "~/v1/line/schema/LineSchema";
import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * A single-use item that consumes its one product line when opened.
 *
 * A stash without `output` disappears after its line completes. A stash with
 * `output` evaluates that output before it disappears.
 */
export const StashItemSchema = z
	.object({
		...BaseItemSchema.shape,
		/**
		 * Identifies this item as a single-use stash.
		 */
		type: ItemEnumSchema.extract([
			"stash",
		]),
		/**
		 * The one product line consumed when this stash is opened.
		 */
		line: LineSchema.describe("The one product line consumed when this stash is opened."),
		/**
		 * Optional output evaluated after this stash's line completes.
		 *
		 * When omitted, the stash simply disappears after its line completes.
		 */
		output: OutputSchema.optional().describe(
			"The optional output evaluated after this stash's line completes.",
		),
	})
	.strict()
	.describe("A single-use stash that consumes one product line when opened.");

export type StashItemSchema = typeof StashItemSchema;

export namespace StashItemSchema {
	export type Type = z.infer<StashItemSchema>;
}
