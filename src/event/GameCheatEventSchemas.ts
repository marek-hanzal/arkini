import { z } from "zod";
import { GameSpeedModeSchema } from "~/event/GameEventBaseSchemas";
import { GameInstantMsSchema } from "~/time/GameTimeSchema";

export const GameCheatSpeedModeChangedEventSchema = z
	.object({
		type: z.literal("cheat.speed_mode.changed"),
		previousMode: GameSpeedModeSchema,
		nextMode: GameSpeedModeSchema,
		atMs: GameInstantMsSchema,
	})
	.strict();
