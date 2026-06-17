import { z } from "zod";

const IdSchema = z.string().min(1);

export const ProducerProductLineViewSchema = z.object({
	productId: IdSchema,
	name: z.string().min(1),
	durationMs: z.number().int().nonnegative(),
	enabled: z.boolean(),
	inProgress: z.boolean(),
	queuedJobs: z.number().int().nonnegative(),
	startedAtMs: z.number().int().nonnegative().optional(),
	readyAtMs: z.number().int().nonnegative().optional(),
	progress: z.number().min(0).max(1).optional(),
	inputItemIds: z.array(IdSchema),
	requirementItemIds: z.array(IdSchema),
	outputTableId: IdSchema.optional(),
});

type ProducerProductLineViewSchema = typeof ProducerProductLineViewSchema;
export namespace ProducerProductLineViewSchema {
	export type Type = z.infer<ProducerProductLineViewSchema>;
}

export type ProducerProductLineView = ProducerProductLineViewSchema.Type;
