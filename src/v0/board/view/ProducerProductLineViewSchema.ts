import { z } from "zod";
import { ActivationInputViewSchema } from "~/v0/board/view/ActivationInputViewSchema";
import { ActivationRequirementViewSchema } from "~/v0/board/view/ActivationRequirementViewSchema";

const IdSchema = z.string().min(1);

const ProducerProductLineOutputViewSchema = z.object({
	itemId: IdSchema,
	ownedQuantity: z.number().int().nonnegative(),
});

export const ProducerProductLineViewSchema = z.object({
	productId: IdSchema,
	name: z.string().min(1),
	lineKind: z
		.enum([
			"effect",
			"product",
		])
		.optional(),
	isDefault: z.boolean(),
	durationMs: z.number().int().nonnegative(),
	inProgress: z.boolean(),
	producerQueuedJobs: z.number().int().nonnegative(),
	queueFull: z.boolean(),
	blocked: z.boolean(),
	effectLocked: z.boolean().optional(),
	blockReasonEffectIds: z.array(IdSchema),
	deliveryBlocked: z.boolean().optional(),
	queueBlockedReason: z
		.enum([
			"delivery_blocked",
			"paused",
		])
		.optional(),
	queueSize: z.number().int().positive(),
	queuedJobs: z.number().int().nonnegative(),
	inputs: z.array(ActivationInputViewSchema),
	inputsReady: z.boolean(),
	inputsAvailable: z.boolean(),
	requirementsReady: z.boolean(),
	missingRequirementItemIds: z.array(IdSchema),
	startAtMs: z.number().int().nonnegative().optional(),
	readyAtMs: z.number().int().nonnegative().optional(),
	remainingMs: z.number().int().nonnegative().optional(),
	pausedAtMs: z.number().int().nonnegative().optional(),
	progress: z.number().min(0).max(1).optional(),
	inputItemIds: z.array(IdSchema),
	requirementItemIds: z.array(IdSchema),
	requirements: z.array(ActivationRequirementViewSchema).optional(),
	effectDurationMultiplier: z.number().min(1).optional(),
	effectBenefits: z.array(z.string().min(1)).optional(),
	outputs: z.array(ProducerProductLineOutputViewSchema).optional(),
});

type ProducerProductLineViewSchema = typeof ProducerProductLineViewSchema;
export namespace ProducerProductLineViewSchema {
	export type Type = z.infer<ProducerProductLineViewSchema>;
}

export type ProducerProductLineView = ProducerProductLineViewSchema.Type;
