import { z } from "zod";
import { GameItemIdSchema } from "~/manifest/GameItemIdSchema";
import { BoardItemIdSchema } from "./BoardItemIdSchema";

export const WithdrawProducerInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
	itemId: GameItemIdSchema,
});

type WithdrawProducerInputSchema = typeof WithdrawProducerInputSchema;
export namespace WithdrawProducerInputSchema {
	export type Type = z.infer<WithdrawProducerInputSchema>;
}
