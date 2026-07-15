import { z } from "zod";

import { CurrentSpaceChangedGameEventSchema } from "./CurrentSpaceChangedGameEventSchema";
import { JobCompletedGameEventSchema } from "./JobCompletedGameEventSchema";
import { JobStartedGameEventSchema } from "./JobStartedGameEventSchema";
import { ItemMergedGameEventSchema } from "./ItemMergedGameEventSchema";
import { ItemExpiredGameEventSchema } from "./ItemExpiredGameEventSchema";
import { SpeedModeChangedGameEventSchema } from "./SpeedModeChangedGameEventSchema";

export const GameEventSchema = z.discriminatedUnion("type", [
	CurrentSpaceChangedGameEventSchema,
	JobStartedGameEventSchema,
	JobCompletedGameEventSchema,
	ItemMergedGameEventSchema,
	ItemExpiredGameEventSchema,
	SpeedModeChangedGameEventSchema,
]);

export type GameEventSchema = typeof GameEventSchema;

export namespace GameEventSchema {
	export type Type = z.infer<GameEventSchema>;
}
