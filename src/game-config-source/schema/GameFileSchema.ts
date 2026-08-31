import { z } from "zod";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { GameProjectGameSchemaReference } from "~/game-config-source/constant/GameProjectReference";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

/** Complete portable project root; item definitions live in separate files. */
export const GameFileSchema = GameConfigSchema.omit({
	items: true,
})
	.extend({
		$schema: z.literal(GameProjectGameSchemaReference),
		version: GameVersionSchema,
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
