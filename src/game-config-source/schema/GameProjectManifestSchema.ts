import { z } from "zod";

import { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";

/** Root marker required before a directory can be opened as a game project. */
export const GameProjectManifestSchema = z
	.object({
		serakki: SerakkiVersionSchema,
		revision: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "GameProjectManifestSchema",
		$id: "urn:serakki:schema:game-project-manifest",
		title: "Serakki game project manifest",
		description: "The minimal root marker for one portable game project directory.",
	});

export type GameProjectManifestSchema = typeof GameProjectManifestSchema;

export namespace GameProjectManifestSchema {
	export type Type = z.infer<GameProjectManifestSchema>;
}
