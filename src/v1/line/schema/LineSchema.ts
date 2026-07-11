import { z } from "zod";
import { InputSchema } from "~/v1/input/schema/InputSchema";
import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { DescriptionSchema } from "~/v1/common/schema/DescriptionSchema";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { TimeSchema } from "~/v1/common/schema/TimeSchema";
import { TitleSchema } from "~/v1/common/schema/TitleSchema";
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
		 * Stable ID of this product line within its owning item.
		 */
		id: IdSchema.describe("The stable ID of this product line within its owning item."),
		/**
		 * Human-readable title of this product line.
		 */
		title: TitleSchema.describe("The human-readable title of this product line."),
		/**
		 * Human-readable explanation of this product line's purpose.
		 */
		description: DescriptionSchema.describe(
			"The human-readable explanation of this product line's purpose.",
		),
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
		 * Whether this product line is enabled before its rules are evaluated.
		 *
		 * When enable rules are configured, all of them must pass; a fully satisfied
		 * set can enable a line whose default is `false`. Any applicable `disable`
		 * rule vetoes the final availability.
		 */
		enable: z
			.boolean()
			.default(true)
			.describe("Whether this product line is enabled before its rules are evaluated."),
		/**
		 * Runtime of this product line in milliseconds.
		 *
		 * Zero means that the line completes immediately.
		 */
		runtimeMs: TimeSchema.describe(
			"The runtime of this product line in milliseconds; zero completes immediately.",
		),
		/**
		 * One or more input requirements for this product line.
		 */
		input: z
			.tuple(
				[
					InputSchema,
				],
				InputSchema,
			)
			.describe("One or more input requirements for this product line."),
		/**
		 * Optional result produced when this product line completes.
		 *
		 * A line may consume its input without producing an output, for example
		 * when a purifier removes pollution.
		 */
		output: OutputSchema.optional().describe(
			"The optional result produced when this product line completes.",
		),
		/**
		 * Rules that can change this product line's visibility, availability, or behavior.
		 *
		 * Show and hide rules resolve visibility. Enable rules form positive
		 * availability gates, while any applicable disable rule has veto power.
		 */
		rules: z
			.array(RuleSchema)
			.describe(
				"Rules that can change this product line's visibility, availability, or behavior.",
			),
	})
	.strict()
	.meta({
		id: "LineSchema",
		description: "A single product line with its accepted inputs and produced output.",
	});

export type LineSchema = typeof LineSchema;

export namespace LineSchema {
	export type Type = z.infer<LineSchema>;
}
