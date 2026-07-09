import { z } from "zod";

import { InputSchema } from "../input/InputSchema";
import { OutputSchema } from "../output/OutputSchema";

/**
 * A single product line with its accepted inputs and produced output.
 *
 * Items that own lines may compose this schema into one or more product-line
 * capabilities without duplicating the input and output contract.
 */
export const LineSchema = z
	.object({
		/**
		 * One or more items accepted by this product line.
		 */
		input: z
			.tuple(
				[
					InputSchema,
				],
				InputSchema,
			)
			.describe("One or more items accepted by this product line."),
		/**
		 * Result produced when this product line completes.
		 */
		output: OutputSchema.describe("The result produced when this product line completes."),
	})
	.strict()
	.describe("A single product line with its accepted inputs and produced output.");

export type LineSchema = typeof LineSchema;

export namespace LineSchema {
	export type Type = z.infer<LineSchema>;
}
