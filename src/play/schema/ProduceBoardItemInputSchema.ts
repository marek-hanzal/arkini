import { z } from "zod";
import { BoardItemIdSchema } from "./BoardItemIdSchema";
import { GameActionActivationSchema } from "./GameActionActivationSchema";

export const ProduceBoardItemInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
	activation: GameActionActivationSchema.default("single"),
});

type ProduceBoardItemInputSchema = typeof ProduceBoardItemInputSchema;
export namespace ProduceBoardItemInputSchema {
	export type Type = z.infer<ProduceBoardItemInputSchema>;
}
