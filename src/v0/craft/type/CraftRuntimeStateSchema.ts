import { z } from "zod";

export const CraftRuntimeStateSchema = z.object({
	startedAt: z.string().optional(),
	readyAt: z.string().optional(),
	remainingMs: z.number().nonnegative().optional(),
});
