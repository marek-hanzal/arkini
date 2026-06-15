import { z } from "zod";
import { GameItemIdSchema } from "~/manifest/GameItemIdSchema";
import { BoardItemIdSchema } from "~/play/schema/BoardItemIdSchema";

export const WithdrawActivationInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
	itemId: GameItemIdSchema,
});

type WithdrawActivationInputSchema = typeof WithdrawActivationInputSchema;
export namespace WithdrawActivationInputSchema {
	export type Type = z.infer<WithdrawActivationInputSchema>;
}
