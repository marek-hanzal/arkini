import { z } from "zod";
import { NeighborChanceModeSchema } from "./NeighborChanceModeSchema";
import { NeighborChanceSourceSchema } from "./NeighborChanceSourceSchema";

export const NeighborChanceRuleSchema = z.object({
	mode: NeighborChanceModeSchema,
	sources: z.array(NeighborChanceSourceSchema),
});
