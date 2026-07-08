import { z } from "zod";
import { NeighborCapacitySpendSchema } from "./NeighborCapacitySpendSchema";
import { OutputPlacementSchema } from "./OutputPlacementSchema";
import { OutputSetSchema } from "./OutputSetSchema";
import { RuleBlockerSchema } from "./RuleBlockerSchema";
import { RuleConditionSchema } from "./RuleConditionSchema";
import { TimedStatusSchema } from "./TimedStatusSchema";
import { DurationMsSchema } from "./DurationMsSchema";
import { WorkInputSchema } from "./WorkInputSchema";
import { WorkModifierSchema } from "./WorkModifierSchema";

export const WorkRecipeSchema = z.object({
	durationMs: DurationMsSchema,
	inputs: z.array(WorkInputSchema).optional(),
	requires: RuleConditionSchema.optional(),
	blockers: z.array(RuleBlockerSchema).optional(),
	modifiers: z.array(WorkModifierSchema).optional(),
	neighborCapacitySpends: z.array(NeighborCapacitySpendSchema).optional(),
	output: z.array(OutputSetSchema).optional(),
	appliesStatus: TimedStatusSchema.optional(),
	placement: OutputPlacementSchema.optional(),
});
