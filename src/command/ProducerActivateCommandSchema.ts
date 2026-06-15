import { z } from "zod";
import { BoardItemIdSchema } from "~/play/schema/BoardItemIdSchema";
import { GameActionActivationSchema } from "~/play/schema/GameActionActivationSchema";

export const ProducerActivateCommandSchema = z.object({
	type: z.literal("producer.activate"),
	boardItemId: BoardItemIdSchema,
	activation: GameActionActivationSchema.optional(),
});

type ProducerActivateCommandSchema = typeof ProducerActivateCommandSchema;
export namespace ProducerActivateCommandSchema {
	export type Type = z.infer<ProducerActivateCommandSchema>;
}
