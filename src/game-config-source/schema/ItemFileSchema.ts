import { z } from "zod";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { GameProjectItemSchemaReference } from "~/game-config-source/constant/GameProjectReference";

/** One canonical UID-owned item fragment in a portable game project. */
export const ItemFileSchema = z
	.object({
		$schema: z.literal(GameProjectItemSchemaReference),
		item: ItemSchema.describe("The canonical item owned by this UID-named file."),
	})
	.strict()
	.meta({
		id: "ItemFileSchema",
		$id: "urn:arkini:schema:item-file",
		title: "Arkini item source file",
		description: "One item stored at items/<type>/<encoded uid>.json.",
	});

export type ItemFileSchema = typeof ItemFileSchema;

export namespace ItemFileSchema {
	export type Type = z.infer<ItemFileSchema>;
}
