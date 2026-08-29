import { z } from "zod";

import { GameEventSchema } from "./GameEventSchema";

export const GameEventBatchSchema = z
	.object({
		events: z.array(GameEventSchema).min(1),
	})
	.strict()
	.meta({
		id: "GameEventBatchSchema",
		description:
			"One ordered transient event batch carried by an atomically committed runtime transition.",
	});

export type GameEventBatchSchema = typeof GameEventBatchSchema;

export namespace GameEventBatchSchema {
	export type Type = z.infer<GameEventBatchSchema>;
}
