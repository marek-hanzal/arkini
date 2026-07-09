import { z } from "zod";
import { ActivationOutputSchema } from "~/config/schema/GameActivationOutputSchema";
import { IdSchema } from "~/config/schema/GameConfigScalarSchemas";

const MergeRuleBaseSchema = z
	.object({
		withItemId: IdSchema,
		secret: z.boolean().optional(),
	})
	.strict();

const ReplaceMergeRuleSchema = MergeRuleBaseSchema.extend({
	resultItemId: IdSchema,
	targetMode: z.literal("replace").optional(),
	output: ActivationOutputSchema.min(1).optional(),
}).strict();

const KeepMergeRuleSchema = MergeRuleBaseSchema.extend({
	targetMode: z.literal("keep"),
	output: ActivationOutputSchema.min(1),
}).strict();

export const MergeRuleSchema = z.union([
	KeepMergeRuleSchema,
	ReplaceMergeRuleSchema,
]);
