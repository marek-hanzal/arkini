import { z } from "zod";

import { DropResultSchema } from "./DropResultSchema";

/**
 * Fully resolved item drops produced by one output evaluation.
 *
 * Exactly one configured roll set has already been selected, all of its rolls
 * evaluated, rejected drops discarded, and accepted quantities resolved.
 */
export const OutputResultSchema = z
	.object({
		/**
		 * Concrete item drops ready for the later placement layer.
		 */
		drop: z
			.array(DropResultSchema)
			.describe("The concrete item drops ready for the later placement layer."),
	})
	.strict()
	.meta({
		id: "OutputResultSchema",
		description:
			"The resolved, intentionally possibly empty item drops produced by one output evaluation.",
	});

export type OutputResultSchema = typeof OutputResultSchema;

export namespace OutputResultSchema {
	export type Type = z.infer<OutputResultSchema>;
}
