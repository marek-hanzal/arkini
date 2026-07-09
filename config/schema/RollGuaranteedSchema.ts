import { z } from "zod";

import { BaseRollSchema } from "./BaseRollSchema";
import { DropSchema } from "./DropSchema";
import { RollTypeEnumSchema } from "./RollTypeEnumSchema";

/**
 * An output roll that provides its output whenever its rules allow it.
 */
export const RollGuaranteedSchema = z
	.object({
		...BaseRollSchema.shape,
		type: RollTypeEnumSchema.extract([
			"guaranteed",
		]),
		/**
		 * Items emitted when this roll succeeds.
		 */
		drop: z.array(DropSchema).describe("The items emitted when this roll succeeds."),
	})
	.strict()
	.describe("A roll that guarantees its output when its rules allow it.");

export type RollGuaranteedSchema = typeof RollGuaranteedSchema;

export namespace RollGuaranteedSchema {
	export type Type = z.infer<RollGuaranteedSchema>;
}
