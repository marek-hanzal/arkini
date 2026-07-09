import { z } from "zod";
import { IdSchema, NonNegativeIntegerSchema } from "~/event/GameEventBaseSchemas";
import { GameInstantMsSchema } from "~/time/GameTimeSchema";

export const GameBoardMemorySavedEventSchema = z
	.object({
		type: z.literal("board.memory.saved"),
		boardItemId: IdSchema,
		itemCount: NonNegativeIntegerSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameBoardMemoryRestoredEventSchema = z
	.object({
		type: z.literal("board.memory.restored"),
		boardItemId: IdSchema,
		restoredCount: NonNegativeIntegerSchema,
		storedCount: NonNegativeIntegerSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();

export const GameBoardMemoryClearedEventSchema = z
	.object({
		type: z.literal("board.memory.cleared"),
		boardItemId: IdSchema,
		itemCount: NonNegativeIntegerSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();
