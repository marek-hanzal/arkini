import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";

export const CurrentSpaceChangedGameEventSchema = z
	.object({
		type: z.literal("current-space:changed"),
		previousSpace: NonNegativeIntegerSchema,
		currentSpace: NonNegativeIntegerSchema,
	})
	.strict()
	.meta({
		id: "CurrentSpaceChangedGameEventSchema",
		description: "A committed change of the board space currently presented to the player.",
	});

export type CurrentSpaceChangedGameEventSchema = typeof CurrentSpaceChangedGameEventSchema;

export namespace CurrentSpaceChangedGameEventSchema {
	export type Type = z.infer<CurrentSpaceChangedGameEventSchema>;
}
