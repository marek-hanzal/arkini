import { z } from "zod";

import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";

/** Root marker required before a directory can be opened as a game project. */
export const GameProjectManifestSchema = z
	.object({
		arkini: ArkiniVersionSchema,
		revision: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "GameProjectManifestSchema",
		$id: "urn:arkini:schema:game-project-manifest",
		title: "Arkini game project manifest",
		description: "The minimal root marker for one portable game project directory.",
	});

export type GameProjectManifestSchema = typeof GameProjectManifestSchema;

export namespace GameProjectManifestSchema {
	export type Type = z.infer<GameProjectManifestSchema>;
}
