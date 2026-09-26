import { z } from "zod";
import { OutcomeEnumSchema } from "./OutcomeEnumSchema";
import { OutcomeRuleSchema } from "./OutcomeRuleSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

export const TemplateOutcomeSchema = z
	.object({
		type: OutcomeEnumSchema.extract([
			"Template",
		]),
		templateUid: IdSchema.describe("The board template applied by this outcome."),
		space: NonNegativeIntegerSchema.optional().describe(
			"Optional explicit Board space replaced by this template; omission uses the outcome origin space.",
		),
		rules: z.array(OutcomeRuleSchema),
	})
	.strict()
	.meta({
		id: "TemplateOutcomeSchema",
		description:
			"Replaces an explicit Board space, or the outcome origin space when omitted, and its entire owned runtime state with a template.",
	});
export type TemplateOutcomeSchema = typeof TemplateOutcomeSchema;
export namespace TemplateOutcomeSchema {
	export type Type = z.infer<TemplateOutcomeSchema>;
}
