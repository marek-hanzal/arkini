import { z } from "zod";
import { CountSchema } from "./CountSchema";
import { StashDepletedModeSchema } from "./StashDepletedModeSchema";
import { StashLineSchema } from "./StashLineSchema";

export const StashSchema = z.object({
	charges: CountSchema,
	maxQueueSize: CountSchema.optional(),
	onChargesDepleted: StashDepletedModeSchema.optional(),
	line: StashLineSchema,
});
