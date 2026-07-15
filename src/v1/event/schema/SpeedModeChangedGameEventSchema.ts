import { z } from "zod";

import { SpeedModeSchema } from "~/v1/session/schema/SpeedModeSchema";

export const SpeedModeChangedGameEventSchema = z
	.object({
		type: z.literal("speed-mode:changed"),
		speedMode: SpeedModeSchema,
	})
	.strict()
	.meta({
		id: "SpeedModeChangedGameEventSchema",
		description: "A committed change of the runtime session speed mode.",
	});

export type SpeedModeChangedGameEventSchema = typeof SpeedModeChangedGameEventSchema;

export namespace SpeedModeChangedGameEventSchema {
	export type Type = z.infer<SpeedModeChangedGameEventSchema>;
}
