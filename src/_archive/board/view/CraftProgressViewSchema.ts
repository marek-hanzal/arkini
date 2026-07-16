import { z } from "zod";
import { IdSchema } from "~/config/IdSchema";
import { CraftProgressPhaseSchema } from "./CraftProgressPhaseSchema";
import { ItemTargetLimitViewSchema } from "./ItemTargetLimitViewSchema";
import { LineOutputViewSchema } from "./LineViewSchema";

const CraftEffectRequirementViewSchema = z
	.object({
		kind: z
			.enum([
				"grant.blockStart",
				"grant.require",
			])
			.optional(),
		itemId: IdSchema.optional(),
		label: z.string().min(1),
		ready: z.boolean(),
	})
	.strict();

export const CraftProgressViewSchema = z.object({
	id: z.string().min(1),
	resultItemId: IdSchema,
	durationMs: z.number().int().nonnegative(),
	inputs: z.array(
		z.object({
			itemId: IdSchema,
			quantity: z.number().int().nonnegative(),
			available: z.number().int().nonnegative().optional(),
		}),
	),
	delivered: z.record(z.string(), z.number().int().nonnegative()),
	inputProgress: z.number(),
	timeProgress: z.number(),
	progress: z.number(),
	phase: CraftProgressPhaseSchema,
	complete: z.boolean(),
	canAcceptInputs: z.boolean(),
	startRequirementsReady: z.boolean().optional(),
	effectRequirements: z.array(CraftEffectRequirementViewSchema).optional(),
	effectBlocked: z.boolean().optional(),
	effectBlockReasons: z.array(z.string().min(1)).optional(),
	startAtMs: z.number().optional(),
	readyAtMs: z.number().optional(),
	pausedAtMs: z.number().optional(),
	remainingMs: z.number().optional(),
	deliveryBlocked: z.boolean().optional(),
	targetLimitBlocked: z.boolean().optional(),
	targetLimits: z.array(ItemTargetLimitViewSchema).optional(),
	acceptedInputItemIds: z.array(IdSchema),
	outputs: z.array(LineOutputViewSchema).optional(),
});

type CraftProgressViewSchema = typeof CraftProgressViewSchema;
export namespace CraftProgressViewSchema {
	export type Type = z.infer<CraftProgressViewSchema>;
}

export type CraftProgressView = CraftProgressViewSchema.Type;
