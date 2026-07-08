import { z } from "zod";
import { FactRequirementSchema } from "./FactRequirementSchema";
import { NeighborRequirementSchema } from "./NeighborRequirementSchema";

export const RuleConditionSchema = z.object({
	facts: FactRequirementSchema.optional(),
	neighbors: z.array(NeighborRequirementSchema).optional(),
});
