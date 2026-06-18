import { z } from "zod";
import { GameActionItemRefSchema } from "~/v0/game/engine/model/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionProducerInputStoreSchema = z
	.object({
		inputRef: GameActionItemRefSchema,
		producerItemInstanceId: IdSchema,
		productId: IdSchema.optional(),
		type: z.literal("producer.input.store"),
	})
	.strict();

export type GameActionProducerInputStoreSchema = typeof GameActionProducerInputStoreSchema;

export namespace GameActionProducerInputStoreSchema {
	export type Type = z.infer<typeof GameActionProducerInputStoreSchema>;
}
