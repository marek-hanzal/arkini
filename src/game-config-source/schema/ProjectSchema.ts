import { z } from "zod";

import { GameFileSchema } from "~/game-config-source/schema/GameFileSchema";
import { ItemFileSchema } from "~/game-config-source/schema/ItemFileSchema";
import { AudioResourceMetadataSchema } from "~/audio-authoring/schema/AudioResourceMetadataSchema";

/** One fragment accepted by the portable game-project JSON Schema. */
export const ProjectSchema = z
	.union([
		GameFileSchema,
		ItemFileSchema,
		AudioResourceMetadataSchema,
	])
	.meta({
		$id: "urn:serakki:schema:project",
		title: "Serakki project authoring schema",
		description:
			"A strict game.json root, UID-owned item fragment, or Editor audio metadata file.",
	});

export type ProjectSchema = typeof ProjectSchema;

export namespace ProjectSchema {
	export type Type = z.infer<ProjectSchema>;
}
