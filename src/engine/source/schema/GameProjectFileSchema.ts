import { z } from "zod";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { GameProjectGameSchemaReference } from "~/engine/source/GameProjectReference";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Complete portable project root; item definitions live in separate files. */
export const GameProjectFileSchema = GameConfigSchema.omit({
	items: true,
})
	.extend({
		$schema: z.literal(GameProjectGameSchemaReference),
		arkpack: ArkpackVersionSchema,
	})
	.meta({
		id: "GameProjectFileSchema",
		$id: "urn:arkini:schema:game-project-file",
		title: "Arkini game project root file",
		description: "The complete game.json contract excluding items owned by items/<type> files.",
	});

export type GameProjectFileSchema = typeof GameProjectFileSchema;

export namespace GameProjectFileSchema {
	export type Type = z.infer<GameProjectFileSchema>;
}
