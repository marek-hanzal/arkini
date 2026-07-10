import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";
import { LineSchema } from "~/v1/line/schema/LineSchema";

/**
 * A single-use item that provides one craft product line.
 *
 * A craft owns one product line instead of a producer's multiple selectable
 * product lines. After that line completes, runtime consumes the craft item
 * and places its output from the craft item's released board position.
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
		line: LineSchema.describe("The one product line owned by this craft."),
	})
	.strict()
	.meta({
		id: "CraftItemSchema",
		description:
			"A single-use craft item that consumes itself when its product line completes.",
	});

export type CraftItemSchema = typeof CraftItemSchema;

export namespace CraftItemSchema {
	export type Type = z.infer<CraftItemSchema>;
}
