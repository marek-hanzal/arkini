import { z } from "zod";
import { GameConfig } from "./GameConfig";

export const GameMetaDefinitionSchema = z.object({
	id: z.literal(GameConfig.game.id),
	title: z.literal(GameConfig.game.title),
	board: z.object({
		width: z.literal(GameConfig.game.board.width),
		height: z.literal(GameConfig.game.board.height),
	}),
	inventory: z.object({
		slots: z.literal(GameConfig.game.inventory.slots),
	}),
});

type GameMetaDefinitionSchema = typeof GameMetaDefinitionSchema;
export namespace GameMetaDefinitionSchema {
	export type Type = z.infer<GameMetaDefinitionSchema>;
}
