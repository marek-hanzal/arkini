import { z } from "zod";
import { GameItemIdSchema } from "~/v0/manifest/GameItemIdSchema";
import { BoardItemIdSchema } from "~/v0/board/schema/BoardItemIdSchema";

export const WithdrawActivationInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
	itemId: GameItemIdSchema,
});

type WithdrawActivationInputSchema = typeof WithdrawActivationInputSchema;
export namespace WithdrawActivationInputSchema {
	export type Type = z.infer<WithdrawActivationInputSchema>;
}
