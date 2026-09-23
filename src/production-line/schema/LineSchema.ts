import { z } from "zod";
import { InputSchema } from "~/production-input/schema/InputSchema";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { DescriptionSchema } from "~/game-value/schema/DescriptionSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { TimeSchema } from "~/game-value/schema/TimeSchema";
import { TitleSchema } from "~/game-value/schema/TitleSchema";
import { RuleSchema } from "./RuleSchema";

/**
 * A single product line with its accepted inputs and produced outcome.
 *
 * Items that own lines may compose this schema into one or more product-line
 * capabilities without duplicating the input and outcome contract.
 */
export const LineSchema = z
	.object({
		/**
		 * Immutable generated identity, unique among all product lines in the project.
		 */
		uid: IdSchema.describe(
			"The immutable generated UID of this product line, unique across the project.",
		),
		/**
		 * Human-readable title of this product line.
		 */
		title: TitleSchema.describe("The human-readable title of this product line."),
		artwork: IdSchema.optional().describe(
			"Optional Artwork resource ID shown beside the production line title.",
		),
		/**
		 * Human-readable explanation of this product line's purpose.
		 */
		description: DescriptionSchema.describe(
			"The human-readable explanation of this product line's purpose.",
		),
		clock: z
			.boolean()
			.optional()
			.describe(
				"Whether this line participates in weighted Clock selection, independently of Default.",
			),
		clockWeight: z
			.number()
			.int()
			.min(1)
			.max(999)
			.default(1)
			.describe(
				"Relative Clock selection weight among lines allowed by their evaluated rules.",
			),
		/**
		 * Whether this line is the authored fallback default for its owning item.
		 *
		 * The preset is resolved from immutable config and does not create runtime
		 * owner state until the player explicitly overrides or uses the line.
		 */
		default: z
			.boolean()
			.default(false)
			.describe("Whether this line is the authored fallback default for its owning item."),
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
		 * A line may consume its input without producing an outcome, for example
		 * when a purifier removes pollution.
		 */
		outcome: OutcomeTableSchema.optional().describe(
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
		description: "A single product line with its accepted inputs and produced outcome.",
	});

export type LineSchema = typeof LineSchema;

export namespace LineSchema {
	export type Type = z.infer<LineSchema>;
}
