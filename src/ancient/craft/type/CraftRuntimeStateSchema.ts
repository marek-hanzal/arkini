import { z } from "zod";

export const CraftRuntimeStateSchema = z.object({
	startedAt: z.string().optional(),
	readyAt: z.string().optional(),
	remainingMs: z.number().nonnegative().optional(),
});

type CraftRuntimeStateSchema = typeof CraftRuntimeStateSchema;
export namespace CraftRuntimeStateSchema {
	export type Type = z.infer<CraftRuntimeStateSchema>;
}
