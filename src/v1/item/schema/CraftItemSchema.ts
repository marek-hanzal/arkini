import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";
import { CraftLineSchema } from "~/v1/line/schema/CraftLineSchema";

/**
 * An item configuration that provides one craft product line.
 *
 * A craft owns one product line instead of a producer's multiple selectable
 * product lines. Runtime start isolates one craft quantity from any stack, and completion
 * consumes that owner while interpreting replacement through standard output placement.
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
		line: CraftLineSchema.describe("The one product line owned by this craft."),
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
