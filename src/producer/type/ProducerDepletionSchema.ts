import { z } from "zod";
import { GameItemIdSchema } from "~/manifest/GameItemIdSchema";

export const ProducerDepletionSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("remove"),
	}),
	z.object({
		kind: z.literal("replace"),
		itemId: GameItemIdSchema,
	}),
]);

type ProducerDepletionSchema = typeof ProducerDepletionSchema;
export namespace ProducerDepletionSchema {
	export type Type = z.infer<ProducerDepletionSchema>;
}

export type ProducerDepletion = ProducerDepletionSchema.Type;
