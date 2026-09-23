import { z } from "zod";
import { OutcomeEnumSchema } from "./OutcomeEnumSchema";
import { OutcomeRuleSchema } from "./OutcomeRuleSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
export const SpaceOutcomeSchema = z
	.object({
		type: OutcomeEnumSchema.extract([
			"Space",
		]),
		space: NonNegativeIntegerSchema.describe("The destination Board space."),
		rules: z.array(OutcomeRuleSchema),
	})
	.strict()
	.meta({
		id: "SpaceOutcomeSchema",
		description: "Selects the player's Board space when this outcome settles.",
	});
export type SpaceOutcomeSchema = typeof SpaceOutcomeSchema;
export namespace SpaceOutcomeSchema {
	export type Type = z.infer<SpaceOutcomeSchema>;
}
