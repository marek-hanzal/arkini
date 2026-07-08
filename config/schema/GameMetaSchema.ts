import { z } from "zod";
import { BoardConfigSchema } from "./BoardConfigSchema";
import { IdSchema } from "./IdSchema";
import { IntegerSchema } from "./IntegerSchema";
import { InventoryConfigSchema } from "./InventoryConfigSchema";

export const GameMetaSchema = z.object({
	id: IdSchema,
	title: z.string(),
	version: IntegerSchema,
	board: BoardConfigSchema,
	inventory: InventoryConfigSchema,
});
