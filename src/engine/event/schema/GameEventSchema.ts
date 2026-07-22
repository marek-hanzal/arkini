import { z } from "zod";

import { CurrentSpaceChangedGameEventSchema } from "./CurrentSpaceChangedGameEventSchema";
import { JobCompletedGameEventSchema } from "./JobCompletedGameEventSchema";
import { JobStartedGameEventSchema } from "./JobStartedGameEventSchema";
import { ItemMergedGameEventSchema } from "./ItemMergedGameEventSchema";
import { ItemExpiredGameEventSchema } from "./ItemExpiredGameEventSchema";
import { ItemSpawnedGameEventSchema } from "./ItemSpawnedGameEventSchema";
import { ItemStackedGameEventSchema } from "./ItemStackedGameEventSchema";
import { ItemSplitGameEventSchema } from "./ItemSplitGameEventSchema";
import { ItemConsumedGameEventSchema } from "./ItemConsumedGameEventSchema";
import { ItemDepletedGameEventSchema } from "./ItemDepletedGameEventSchema";
import { ItemRemovedGameEventSchema } from "./ItemRemovedGameEventSchema";
import { ItemReplacedGameEventSchema } from "./ItemReplacedGameEventSchema";

export const GameEventSchema = z.discriminatedUnion("type", [
	CurrentSpaceChangedGameEventSchema,
	JobStartedGameEventSchema,
	JobCompletedGameEventSchema,
	ItemMergedGameEventSchema,
	ItemExpiredGameEventSchema,
	ItemSpawnedGameEventSchema,
	ItemStackedGameEventSchema,
	ItemSplitGameEventSchema,
	ItemConsumedGameEventSchema,
	ItemDepletedGameEventSchema,
	ItemRemovedGameEventSchema,
	ItemReplacedGameEventSchema,
]);

export type GameEventSchema = typeof GameEventSchema;

export namespace GameEventSchema {
	export type Type = z.infer<GameEventSchema>;
}
