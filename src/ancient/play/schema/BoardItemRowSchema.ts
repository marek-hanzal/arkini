import { z } from "zod";
import { GameItemIdSchema } from "~/manifest/GameItemIdSchema";
import { BoardCellSchema } from "./BoardCellSchema";
import { BoardItemIdSchema } from "./BoardItemIdSchema";

export const BoardItemRowSchema = z.object({
	id: BoardItemIdSchema,
	saveGameId: z.string().min(1),
	itemDefinitionId: GameItemIdSchema,
	x: BoardCellSchema.shape.x,
	y: BoardCellSchema.shape.y,
	stateJson: z.string(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});

type BoardItemRowSchema = typeof BoardItemRowSchema;
export namespace BoardItemRowSchema {
	export type Type = z.infer<BoardItemRowSchema>;
}
