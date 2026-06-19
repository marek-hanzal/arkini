import { z } from "zod";
import { GameActionItemRefSchema } from "~/v0/game/action/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionProducerProductStartSchema = z
	.object({
		inputRefs: z.array(GameActionItemRefSchema),
		producerItemInstanceId: IdSchema,
		productId: IdSchema,
		type: z.literal("producer.product.start"),
	})
	.strict();

export type GameActionProducerProductStartSchema = typeof GameActionProducerProductStartSchema;

export namespace GameActionProducerProductStartSchema {
	export type Type = z.infer<typeof GameActionProducerProductStartSchema>;
}
