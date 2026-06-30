import { z } from "zod";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";

const PositiveIntegerSchema = z.number().int().positive();

const GameActionDebugItemSpawnLocationSchema = z.enum([
	"board",
	"inventory",
]);

export const GameActionDebugItemSpawnSchema = z
	.object({
		itemId: GameItemIdSchema,
		location: GameActionDebugItemSpawnLocationSchema,
		quantity: PositiveIntegerSchema.optional(),
		type: z.literal("debug.item.spawn"),
	})
	.strict();

export type GameActionDebugItemSpawnSchema = typeof GameActionDebugItemSpawnSchema;

export namespace GameActionDebugItemSpawnSchema {
	export type Type = z.infer<typeof GameActionDebugItemSpawnSchema>;
}
