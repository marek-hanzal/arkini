import { z } from "zod";
import { ActivationHindranceViewSchema } from "~/v0/board/view/ActivationHindranceViewSchema";
import { ActivationInputViewSchema } from "~/v0/board/view/ActivationInputViewSchema";
import { ActivationRequirementViewSchema } from "~/v0/board/view/ActivationRequirementViewSchema";

const IdSchema = z.string().min(1);

export const ProducerProductLineViewSchema = z.object({
	productId: IdSchema,
	name: z.string().min(1),
	isDefault: z.boolean(),
	durationMs: z.number().int().nonnegative(),
	inProgress: z.boolean(),
	producerQueuedJobs: z.number().int().nonnegative(),
	queueFull: z.boolean(),
	blocked: z.boolean(),
	blockReasonEffectIds: z.array(IdSchema),
	queueSize: z.number().int().positive(),
	queuedJobs: z.number().int().nonnegative(),
	inputs: z.array(ActivationInputViewSchema),
	inputsReady: z.boolean(),
	inputsAvailable: z.boolean(),
	requirementsReady: z.boolean(),
	missingRequirementItemIds: z.array(IdSchema),
	startAtMs: z.number().int().nonnegative().optional(),
	readyAtMs: z.number().int().nonnegative().optional(),
	progress: z.number().min(0).max(1).optional(),
	inputItemIds: z.array(IdSchema),
	requirementItemIds: z.array(IdSchema),
	requirements: z.array(ActivationRequirementViewSchema).optional(),
	hindrances: z.array(ActivationHindranceViewSchema).optional(),
	outputItemIds: z.array(IdSchema).optional(),
});

type ProducerProductLineViewSchema = typeof ProducerProductLineViewSchema;
export namespace ProducerProductLineViewSchema {
	export type Type = z.infer<ProducerProductLineViewSchema>;
}

export type ProducerProductLineView = ProducerProductLineViewSchema.Type;
