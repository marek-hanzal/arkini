import { z } from "zod";
import { ItemIdSchema } from "~/manifest/ItemIdSchema";
import { BoardItemIdSchema } from "./BoardItemIdSchema";

export const WithdrawProducerInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
	itemId: ItemIdSchema,
});
