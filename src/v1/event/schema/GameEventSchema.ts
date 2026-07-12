import { z } from "zod";

import { JobCompletedGameEventSchema } from "./JobCompletedGameEventSchema";
import { JobStartedGameEventSchema } from "./JobStartedGameEventSchema";

export const GameEventSchema = z.discriminatedUnion("type", [
	JobStartedGameEventSchema,
	JobCompletedGameEventSchema,
]);

export type GameEventSchema = typeof GameEventSchema;

export namespace GameEventSchema {
	export type Type = z.infer<GameEventSchema>;
}
