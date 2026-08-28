import { z } from "zod";

import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { GameProjectItemSchemaReference } from "~/engine/source/GameProjectReference";

/** One canonical UID-owned item fragment in a portable game project. */
export const GameProjectItemFileSchema = z
	.object({
		$schema: z.literal(GameProjectItemSchemaReference),
		item: ItemSchema.describe("The canonical item owned by this UID-named file."),
	})
	.strict()
	.meta({
		id: "GameProjectItemFileSchema",
		$id: "urn:arkini:schema:game-project-item-file",
		title: "Arkini game project item file",
		description: "One item stored at items/<type>/<encoded uid>.json.",
	});

export type GameProjectItemFileSchema = typeof GameProjectItemFileSchema;

export namespace GameProjectItemFileSchema {
	export type Type = z.infer<GameProjectItemFileSchema>;
}
