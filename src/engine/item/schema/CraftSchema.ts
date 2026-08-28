import { z } from "zod";

import { LineSchema } from "~/engine/line/schema/LineSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * An item configuration that provides one craft product line.
 *
 * A craft owns one product line instead of a producer's multiple selectable
 * product lines. Runtime start isolates one craft quantity from any stack. Output placement is authored by the line, while item lifetime is expressed by optional charges.
 */
export const CraftSchema = z
	.object({
		...BaseSchema.shape,
		type: TypeSchema.extract([
			"Craft",
		]),
		/**
		 * The one product line owned by this craft.
		 */
		line: LineSchema.describe("The one product line owned by this craft."),
	})
	.strict()
	.meta({
		id: "item.CraftSchema",
		description: "An item configuration that owns one craft product line.",
	});

export type CraftSchema = typeof CraftSchema;

export namespace CraftSchema {
	export type Type = z.infer<CraftSchema>;
}
