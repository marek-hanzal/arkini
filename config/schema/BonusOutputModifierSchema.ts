import { z } from "zod";
import { OutputEntrySchema } from "./OutputEntrySchema";
import { RuleConditionSchema } from "./RuleConditionSchema";

export const BonusOutputModifierSchema = z.object({
	kind: z.literal("bonus_output"),
	when: RuleConditionSchema,
	output: OutputEntrySchema,
});
