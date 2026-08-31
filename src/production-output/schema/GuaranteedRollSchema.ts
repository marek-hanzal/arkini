import { z } from "zod";

import { DropSchema } from "~/production-output/schema/DropSchema";

import { BaseRollSchema } from "./BaseRollSchema";
import { RollTypeSchema } from "./RollTypeSchema";

/**
 * An output roll that provides its output whenever its rules allow it.
 */
export const GuaranteedRollSchema = z
	.object({
		...BaseRollSchema.shape,
		type: RollTypeSchema.extract([
			"Guaranteed",
		]),
		/**
		 * One or more items emitted when this roll succeeds.
		 */
		drop: z
			.tuple(
				[
					DropSchema,
				],
				DropSchema,
			)
			.describe("One or more items emitted when this roll succeeds."),
	})
	.strict()
	.meta({
		id: "roll.GuaranteedSchema",
		description: "A roll that guarantees its output when its rules allow it.",
	});

export type GuaranteedRollSchema = typeof GuaranteedRollSchema;

export namespace GuaranteedRollSchema {
	export type Type = z.infer<GuaranteedRollSchema>;
}
