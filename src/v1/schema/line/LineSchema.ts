import { z } from "zod";
import { InputSchema } from "../input/InputSchema";
import { OutputSchema } from "../output/OutputSchema";
import { TimeSchema } from "../util/TimeSchema";
import { RuleSchema } from "./rule/RuleSchema";

/**
 * A single product line with its accepted inputs and produced output.
 *
 * Items that own lines may compose this schema into one or more product-line
 * capabilities without duplicating the input and output contract.
 */
export const LineSchema = z
	.object({
		/**
		 * Whether this product line is visible before its rules are evaluated.
		 *
		 * A line hidden by default can be revealed by an applicable `show` rule.
		 */
		show: z
			.boolean()
			.default(true)
			.describe("Whether this product line is visible before its rules are evaluated."),
		/**
		 * Runtime of this product line in milliseconds.
		 *
		 * Zero means that the line completes immediately.
		 */
		runtimeMs: TimeSchema.describe(
			"The runtime of this product line in milliseconds; zero completes immediately.",
		),
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
		/**
		 * Rules that can change this product line's visibility or behavior.
		 *
		 * Rules are evaluated after the line's `show` default. An applicable `show`
		 * rule can reveal a line whose default visibility is `false`.
		 */
		rules: z
			.array(RuleSchema)
			.describe("Rules that can change this product line's visibility or behavior."),
	})
	.strict()
	.describe("A single product line with its accepted inputs and produced output.");

export type LineSchema = typeof LineSchema;

export namespace LineSchema {
	export type Type = z.infer<LineSchema>;
}
