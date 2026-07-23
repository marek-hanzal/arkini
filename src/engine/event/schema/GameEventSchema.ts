import { z } from "zod";

import { CurrentSpaceChangedGameEventSchema } from "./CurrentSpaceChangedGameEventSchema";
import { JobCompletedGameEventSchema } from "./JobCompletedGameEventSchema";
import { JobStartedGameEventSchema } from "./JobStartedGameEventSchema";
import { ItemInputStoredGameEventSchema } from "./ItemInputStoredGameEventSchema";
import { ItemMergedGameEventSchema } from "./ItemMergedGameEventSchema";
import { ItemExpiredGameEventSchema } from "./ItemExpiredGameEventSchema";
import { ItemSpawnedGameEventSchema } from "./ItemSpawnedGameEventSchema";
import { ItemPlacedGameEventSchema } from "./ItemPlacedGameEventSchema";
import { ItemStackedGameEventSchema } from "./ItemStackedGameEventSchema";
import { ItemSplitGameEventSchema } from "./ItemSplitGameEventSchema";
import { ItemConsumedGameEventSchema } from "./ItemConsumedGameEventSchema";
import { ItemChargeSpentGameEventSchema } from "./ItemChargeSpentGameEventSchema";
import { ItemDepletedGameEventSchema } from "./ItemDepletedGameEventSchema";
import { ItemExplicitlyRemovedGameEventSchema } from "./ItemExplicitlyRemovedGameEventSchema";

export const GameEventSchema = z.discriminatedUnion("type", [
	CurrentSpaceChangedGameEventSchema,
	JobStartedGameEventSchema,
	JobCompletedGameEventSchema,
	ItemMergedGameEventSchema,
	ItemExpiredGameEventSchema,
	ItemSpawnedGameEventSchema,
	ItemPlacedGameEventSchema,
	ItemStackedGameEventSchema,
	ItemSplitGameEventSchema,
	ItemConsumedGameEventSchema,
	ItemInputStoredGameEventSchema,
	ItemChargeSpentGameEventSchema,
	ItemDepletedGameEventSchema,
	ItemExplicitlyRemovedGameEventSchema,
]);

export type GameEventSchema = typeof GameEventSchema;

export namespace GameEventSchema {
	export type Type = z.infer<GameEventSchema>;
}
