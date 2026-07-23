import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

export const CurrentSpaceChangedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"CurrentSpaceChanged",
		]),
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
