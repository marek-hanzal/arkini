import { z } from "zod";

import { GameSourceSchema } from "~/engine/schema/GameSourceSchema";

export const GameSourceFileSchema = z
	.object({
		path: z.string().min(1),
		value: GameSourceSchema,
	})
	.strict()
	.meta({
		id: "GameSourceFileSchema",
		description: "One parsed game source fragment together with its source path.",
	});

export type GameSourceFileSchema = typeof GameSourceFileSchema;

export namespace GameSourceFileSchema {
	export type Type = z.infer<GameSourceFileSchema>;
}
