import { z } from "zod";
import { IdSchema } from "~/config/IdSchema";

const PositiveIntegerSchema = z.number().int().positive();

const GameActionDebugItemSpawnLocationSchema = z.enum([
	"board",
	"inventory",
]);

export const GameActionDebugItemSpawnSchema = z
	.object({
		itemId: IdSchema,
		location: GameActionDebugItemSpawnLocationSchema,
		quantity: PositiveIntegerSchema.optional(),
		type: z.literal("debug.item.spawn"),
	})
	.strict();

export namespace GameActionDebugItemSpawnSchema {
	export type Type = z.infer<typeof GameActionDebugItemSpawnSchema>;
}
