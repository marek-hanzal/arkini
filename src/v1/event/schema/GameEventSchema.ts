import { z } from "zod";

import { JobCompletedGameEventSchema } from "./JobCompletedGameEventSchema";
import { JobStartedGameEventSchema } from "./JobStartedGameEventSchema";
import { ItemMergedGameEventSchema } from "./ItemMergedGameEventSchema";
import { ItemExpiredGameEventSchema } from "./ItemExpiredGameEventSchema";

export const GameEventSchema = z.discriminatedUnion("type", [
	JobStartedGameEventSchema,
	JobCompletedGameEventSchema,
	ItemMergedGameEventSchema,
	ItemExpiredGameEventSchema,
]);

export type GameEventSchema = typeof GameEventSchema;

export namespace GameEventSchema {
	export type Type = z.infer<GameEventSchema>;
}
