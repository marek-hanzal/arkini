import { z } from "zod";
import { RuleConditionSchema } from "./RuleConditionSchema";

export const DurationModifierSchema = z.object({
	kind: z.literal("duration"),
	when: RuleConditionSchema,
	multiplier: z.number(),
});
