import { z } from "zod";
import { ItemIdSchema } from "~/manifest/ItemIdSchema";
import { BoardCellSchema } from "./BoardCellSchema";
import { BoardItemIdSchema } from "./BoardItemIdSchema";

export const BoardItemRowSchema = z.object({
	id: BoardItemIdSchema,
	saveGameId: z.string().min(1),
	itemDefinitionId: ItemIdSchema,
	x: BoardCellSchema.shape.x,
	y: BoardCellSchema.shape.y,
	stateJson: z.string(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});
