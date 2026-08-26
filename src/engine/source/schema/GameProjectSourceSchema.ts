import { z } from "zod";

import { GameProjectFileSchema } from "~/engine/source/schema/GameProjectFileSchema";
import { GameProjectItemFileSchema } from "~/engine/source/schema/GameProjectItemFileSchema";

/** One fragment accepted by the portable game-project JSON Schema. */
export const GameProjectSourceSchema = z
	.union([
		GameProjectFileSchema,
		GameProjectItemFileSchema,
	])
	.meta({
		id: "GameProjectSourceSchema",
		$id: "urn:arkini:schema:game-project-source",
		title: "Arkini game project source schema",
		description: "A strict game.json root or one strict UID-owned item fragment.",
	});

export type GameProjectSourceSchema = typeof GameProjectSourceSchema;

export namespace GameProjectSourceSchema {
	export type Type = z.infer<GameProjectSourceSchema>;
}
