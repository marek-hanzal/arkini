import { z } from "zod";
import { RuleConditionSchema } from "./RuleConditionSchema";

export const RuleBlockerSchema = z.object({
	when: RuleConditionSchema,
	reason: z.string().optional(),
});
