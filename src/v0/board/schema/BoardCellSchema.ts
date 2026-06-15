import { z } from "zod";
import { BoardCoordinateSchema } from "./BoardCoordinateSchema";
import { gameConfig } from "~/v0/game/gameConfig";

export const BoardCellSchema = z.object({
	x: BoardCoordinateSchema.max(gameConfig.game.board.width - 1),
	y: BoardCoordinateSchema.max(gameConfig.game.board.height - 1),
});

type BoardCellSchema = typeof BoardCellSchema;
export namespace BoardCellSchema {
	export type Type = z.infer<BoardCellSchema>;
}
