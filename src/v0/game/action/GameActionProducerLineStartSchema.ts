import { z } from "zod";
import { GameActionItemRefSchema } from "~/v0/game/action/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionProducerLineStartSchema = z
	.object({
		inputRefs: z.array(GameActionItemRefSchema),
		producerItemInstanceId: IdSchema,
		lineId: IdSchema.optional(),
		type: z.literal("producer.line.start"),
	})
	.strict();

export type GameActionProducerLineStartSchema = typeof GameActionProducerLineStartSchema;

export namespace GameActionProducerLineStartSchema {
	export type Type = z.infer<typeof GameActionProducerLineStartSchema>;
}
