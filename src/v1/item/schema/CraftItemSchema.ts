import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";
import { LineSchema } from "~/v1/line/schema/LineSchema";
import { AfterCompletionEnumSchema } from "./AfterCompletionEnumSchema";

/**
 * An item configuration that provides one craft product line.
 *
 * A craft owns one product line instead of a producer's multiple selectable
 * product lines. Runtime start isolates one craft quantity from any stack. Completion behavior and
 * output placement are authored explicitly instead of being inferred from the craft type.
 */
export const CraftItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"craft",
		]),
		afterCompletion: AfterCompletionEnumSchema.describe(
			"What happens to this craft after its line completes.",
		),
		/**
		 * The one product line owned by this craft.
		 */
		line: LineSchema.describe("The one product line owned by this craft."),
	})
	.strict()
	.meta({
		id: "CraftItemSchema",
		description: "An item configuration that owns one craft product line.",
	});

export type CraftItemSchema = typeof CraftItemSchema;

export namespace CraftItemSchema {
	export type Type = z.infer<CraftItemSchema>;
}
