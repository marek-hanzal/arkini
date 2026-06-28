import { z } from "zod";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";
import { CraftProgressPhaseSchema } from "./CraftProgressPhaseSchema";
import { ActivationRequirementViewSchema } from "./ActivationRequirementViewSchema";

export const CraftProgressViewSchema = z.object({
	id: z.string().min(1),
	resultItemId: GameItemIdSchema,
	durationMs: z.number().int().nonnegative(),
	inputs: z.array(
		z.object({
			itemId: GameItemIdSchema,
			quantity: z.number().int().nonnegative(),
			available: z.number().int().nonnegative().optional(),
		}),
	),
	delivered: z.record(z.string(), z.number().int().nonnegative()),
	requirements: z.array(ActivationRequirementViewSchema).optional(),
	inputProgress: z.number(),
	timeProgress: z.number(),
	progress: z.number(),
	phase: CraftProgressPhaseSchema,
	complete: z.boolean(),
	canAcceptInputs: z.boolean(),
	startAtMs: z.number().optional(),
	readyAtMs: z.number().optional(),
	pausedAtMs: z.number().optional(),
	remainingMs: z.number().optional(),
	acceptedInputItemIds: z.array(GameItemIdSchema),
});

type CraftProgressViewSchema = typeof CraftProgressViewSchema;
export namespace CraftProgressViewSchema {
	export type Type = z.infer<CraftProgressViewSchema>;
}

export type CraftProgressView = CraftProgressViewSchema.Type;
