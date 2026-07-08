import { z } from "zod";
import { IdSchema } from "./IdSchema";
import { IntegerSchema } from "./IntegerSchema";
import { NeighborChanceRuleSchema } from "./NeighborChanceRuleSchema";
import { OutputPlacementSchema } from "./OutputPlacementSchema";
import { ProbabilitySchema } from "./ProbabilitySchema";
import { QuantityValueSchema } from "./QuantityValueSchema";
import { RuleConditionSchema } from "./RuleConditionSchema";

export const ChanceOutputEntrySchema = z.object({
	kind: z.literal("chance"),
	itemId: IdSchema,
	chance: ProbabilitySchema,
	quantity: QuantityValueSchema.optional(),
	placement: OutputPlacementSchema.optional(),
	when: RuleConditionSchema.optional(),
	chanceFromNeighbors: NeighborChanceRuleSchema.optional(),
	sort: IntegerSchema.optional(),
});
