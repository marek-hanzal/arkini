import { z } from "zod";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { GameProjectGameSchemaReference } from "~/game-config/source/GameProjectReference";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Complete portable project root; item definitions live in separate files. */
export const GameFileSchema = GameConfigSchema.omit({
	items: true,
})
	.extend({
		$schema: z.literal(GameProjectGameSchemaReference),
		version: ArkpackVersionSchema,
	})
	.meta({
		id: "GameFileSchema",
		$id: "urn:arkini:schema:game-file",
		title: "Arkini game source file",
		description: "The complete game.json contract excluding items owned by items/<type> files.",
	});

export type GameFileSchema = typeof GameFileSchema;

export namespace GameFileSchema {
	export type Type = z.infer<GameFileSchema>;
}
