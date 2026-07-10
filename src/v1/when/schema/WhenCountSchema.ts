import { z } from "zod";

import { BaseWhenSchema } from "./BaseWhenSchema";
import { WhenEnumSchema } from "./WhenEnumSchema";

/**
 * A condition that checks the count of selected items in a game-state scope.
 *
 * The condition is satisfied when the matching item count is greater than or
 * equal to `count`.
 */
export const WhenCountSchema = z
	.object({
		...BaseWhenSchema.shape,
		/**
		 * Identifies this condition as a game-state item-count check.
		 */
		type: WhenEnumSchema.extract([
			"count",
		]).describe("Identifies this condition as a game-state item-count check."),
	})
	.strict()
	.meta({
		id: "WhenCountSchema",
		description: "A condition that checks the count of selected items in a game-state scope.",
	});

export type WhenCountSchema = typeof WhenCountSchema;

export namespace WhenCountSchema {
	export type Type = z.infer<WhenCountSchema>;
}
