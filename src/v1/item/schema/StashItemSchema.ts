import { z } from "zod";
import { LineSchema } from "~/v1/line/schema/LineSchema";
import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item configuration that owns one stash product line and optional output.
 *
 * The schema captures intended stash output. Automatic stash consumption and
 * top-level stash output execution remain separate runtime capabilities.
 */
export const StashItemSchema = z
	.object({
		...BaseItemSchema.shape,
		/**
		 * Identifies this item as a stash authoring definition.
		 */
		type: ItemEnumSchema.extract([
			"stash",
		]),
		/**
		 * The one product line authored for this stash.
		 */
		line: LineSchema.describe("The one product line authored for this stash."),
		/**
		 * Optional output intended for stash-specific completion behavior.
		 */
		output: OutputSchema.optional().describe(
			"The optional output intended for stash-specific completion behavior.",
		),
	})
	.strict()
	.meta({
		id: "StashItemSchema",
		description: "An item configuration with one stash product line and optional output.",
	});

export type StashItemSchema = typeof StashItemSchema;

export namespace StashItemSchema {
	export type Type = z.infer<StashItemSchema>;
}
