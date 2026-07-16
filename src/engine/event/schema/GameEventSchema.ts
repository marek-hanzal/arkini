import { z } from "zod";

import { CheatInventoryConsumedGameEventSchema } from "./CheatInventoryConsumedGameEventSchema";
import { CurrentSpaceChangedGameEventSchema } from "./CurrentSpaceChangedGameEventSchema";
import { JobCompletedGameEventSchema } from "./JobCompletedGameEventSchema";
import { JobStartedGameEventSchema } from "./JobStartedGameEventSchema";
import { ItemMergedGameEventSchema } from "./ItemMergedGameEventSchema";
import { ItemExpiredGameEventSchema } from "./ItemExpiredGameEventSchema";
import { NukeSaveRequestedGameEventSchema } from "./NukeSaveRequestedGameEventSchema";
import { SpeedModeChangedGameEventSchema } from "./SpeedModeChangedGameEventSchema";

export const GameEventSchema = z.discriminatedUnion("type", [
	CheatInventoryConsumedGameEventSchema,
	CurrentSpaceChangedGameEventSchema,
	JobStartedGameEventSchema,
	JobCompletedGameEventSchema,
	ItemMergedGameEventSchema,
	ItemExpiredGameEventSchema,
	SpeedModeChangedGameEventSchema,
	NukeSaveRequestedGameEventSchema,
]);

export type GameEventSchema = typeof GameEventSchema;

export namespace GameEventSchema {
	export type Type = z.infer<GameEventSchema>;
}
