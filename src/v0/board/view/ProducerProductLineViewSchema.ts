import { z } from "zod";
import { ActivationInputViewSchema } from "~/v0/board/view/ActivationInputViewSchema";
import { ActivationRequirementViewSchema } from "~/v0/board/view/ActivationRequirementViewSchema";

const IdSchema = z.string().min(1);

export const ProducerProductLineViewSchema = z.object({
	productId: IdSchema,
	name: z.string().min(1),
	durationMs: z.number().int().nonnegative(),
	enabled: z.boolean(),
	inProgress: z.boolean(),
	producerQueuedJobs: z.number().int().nonnegative(),
	queueFull: z.boolean(),
	queueSize: z.number().int().positive(),
	queuedJobs: z.number().int().nonnegative(),
	inputs: z.array(ActivationInputViewSchema),
	inputsReady: z.boolean(),
	requirementsReady: z.boolean(),
	missingRequirementItemIds: z.array(IdSchema),
	startedAtMs: z.number().int().nonnegative().optional(),
	readyAtMs: z.number().int().nonnegative().optional(),
	progress: z.number().min(0).max(1).optional(),
	inputItemIds: z.array(IdSchema),
	requirementItemIds: z.array(IdSchema),
	requirements: z.array(ActivationRequirementViewSchema).optional(),
	outputTableId: IdSchema.optional(),
});

type ProducerProductLineViewSchema = typeof ProducerProductLineViewSchema;
export namespace ProducerProductLineViewSchema {
	export type Type = z.infer<ProducerProductLineViewSchema>;
}

export type ProducerProductLineView = ProducerProductLineViewSchema.Type;
