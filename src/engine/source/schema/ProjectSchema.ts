import { z } from "zod";

import { GameFileSchema } from "~/engine/source/schema/GameFileSchema";
import { ItemFileSchema } from "~/engine/source/schema/ItemFileSchema";

/** One fragment accepted by the portable game-project JSON Schema. */
export const ProjectSchema = z
	.union([
		GameFileSchema,
		ItemFileSchema,
	])
	.meta({
		$id: "urn:arkini:schema:project",
		title: "Arkini project authoring schema",
		description: "A strict game.json root or one strict UID-owned item fragment.",
	});

export type ProjectSchema = typeof ProjectSchema;

export namespace ProjectSchema {
	export type Type = z.infer<ProjectSchema>;
}
