import { z } from "zod";

import { DropSchema } from "~/production-output/schema/DropSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * An output roll that provides its output whenever its rules allow it.
 */
export const GuaranteedSchema = z
	.object({
		...BaseSchema.shape,
		type: TypeSchema.extract([
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

export type GuaranteedSchema = typeof GuaranteedSchema;

export namespace GuaranteedSchema {
	export type Type = z.infer<GuaranteedSchema>;
}
