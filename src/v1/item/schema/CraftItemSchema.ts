import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";
import { LineSchema } from "~/v1/line/schema/LineSchema";

/**
 * An item configuration that provides one craft product line.
 *
 * A craft owns one product line instead of a producer's multiple selectable
 * product lines. Runtime completion consumes exactly one craft quantity and interprets
 * any resolved replacement through the line output's standard placement contract.
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
		description: "An item configuration that owns one craft product line.",
	});

export type CraftItemSchema = typeof CraftItemSchema;

export namespace CraftItemSchema {
	export type Type = z.infer<CraftItemSchema>;
}
