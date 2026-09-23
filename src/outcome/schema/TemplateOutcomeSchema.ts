import { z } from "zod";
import { OutcomeEnumSchema } from "./OutcomeEnumSchema";
import { OutcomeRuleSchema } from "./OutcomeRuleSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";

export const TemplateOutcomeSchema = z
	.object({
		type: OutcomeEnumSchema.extract([
			"Template",
		]),
		templateUid: IdSchema.describe("The board template applied by this outcome."),
		rules: z.array(OutcomeRuleSchema),
	})
	.strict()
	.meta({
		id: "TemplateOutcomeSchema",
		description: "Replaces a Board space and its entire owned runtime state with a template.",
	});
export type TemplateOutcomeSchema = typeof TemplateOutcomeSchema;
export namespace TemplateOutcomeSchema {
	export type Type = z.infer<TemplateOutcomeSchema>;
}
