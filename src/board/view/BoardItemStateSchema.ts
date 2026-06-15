import { z } from "zod";

export const BoardItemStateSchema = z.object({
	activation: z
		.object({
			cooldownUntil: z.string().optional(),
			remainingCharges: z.number().optional(),
		})
		.optional(),
	craft: z
		.object({
			startedAt: z.string().optional(),
			readyAt: z.string().optional(),
			remainingMs: z.number().optional(),
		})
		.optional(),
});

type BoardItemStateSchema = typeof BoardItemStateSchema;
export namespace BoardItemStateSchema {
	export type Type = z.infer<BoardItemStateSchema>;
}

export type BoardItemState = BoardItemStateSchema.Type;
