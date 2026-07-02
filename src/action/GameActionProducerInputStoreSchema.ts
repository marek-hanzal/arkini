import { z } from "zod";
import { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionProducerInputStoreSchema = z
	.object({
		inputRef: GameActionItemRefSchema,
		itemInstanceId: IdSchema,
		lineId: IdSchema.optional(),
		type: z.literal("producer.input.store"),
	})
	.strict();

export type GameActionProducerInputStoreSchema = typeof GameActionProducerInputStoreSchema;

export namespace GameActionProducerInputStoreSchema {
	export type Type = z.infer<typeof GameActionProducerInputStoreSchema>;
}
