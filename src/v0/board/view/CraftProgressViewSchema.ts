import { z } from "zod";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";
import { CraftProgressPhaseSchema } from "./CraftProgressPhaseSchema";

export const CraftProgressViewSchema = z.object({
	id: z.string().min(1),
	resultItemId: GameItemIdSchema,
	durationMs: z.number().int().nonnegative(),
	inputs: z.array(
		z.object({
			itemId: GameItemIdSchema,
			quantity: z.number().int().nonnegative(),
		}),
	),
	delivered: z.record(z.string(), z.number().int().nonnegative()),
	inputProgress: z.number(),
	timeProgress: z.number(),
	progress: z.number(),
	phase: CraftProgressPhaseSchema,
	complete: z.boolean(),
	canAcceptInputs: z.boolean(),
	startedAtMs: z.number().optional(),
	readyAtMs: z.number().optional(),
	remainingMs: z.number().optional(),
	acceptedInputItemIds: z.array(GameItemIdSchema),
});

type CraftProgressViewSchema = typeof CraftProgressViewSchema;
export namespace CraftProgressViewSchema {
	export type Type = z.infer<CraftProgressViewSchema>;
}

export type CraftProgressView = CraftProgressViewSchema.Type;
