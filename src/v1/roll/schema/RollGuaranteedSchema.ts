import { z } from "zod";

import { BaseRollSchema } from "./BaseRollSchema";
import { DropSchema } from "../../output/schema/DropSchema";
import { RollEnumSchema } from "./RollEnumSchema";

/**
 * An output roll that provides its output whenever its rules allow it.
 */
export const RollGuaranteedSchema = z
	.object({
		...BaseRollSchema.shape,
		type: RollEnumSchema.extract([
			"guaranteed",
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
	.describe("A roll that guarantees its output when its rules allow it.");

export type RollGuaranteedSchema = typeof RollGuaranteedSchema;

export namespace RollGuaranteedSchema {
	export type Type = z.infer<RollGuaranteedSchema>;
}
