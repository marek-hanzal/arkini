import { z } from "zod";

import { LineSchema } from "~/v1/line/schema/LineSchema";
import { AfterCompletionEnumSchema } from "./AfterCompletionEnumSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An item configuration that owns one ordinary product line.
 *
 * Output and placement use the shared line contract. Completion behavior is
 * authored explicitly instead of being inferred from the stash type.
 */
export const StashItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"stash",
		]),
		afterCompletion: AfterCompletionEnumSchema.describe(
			"What happens to this stash after its line completes.",
		),
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
