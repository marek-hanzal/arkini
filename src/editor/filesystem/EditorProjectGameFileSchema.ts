import { z } from "zod";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { EditorProjectGameSchemaReference } from "./EditorProjectSchemaReference";

/** Project-wide authored configuration stored separately from standalone item files. */
export const EditorProjectGameFileSchema = GameConfigSchema.omit({
	items: true,
})
	.extend({
		$schema: z.literal(EditorProjectGameSchemaReference),
		arkpack: ArkpackVersionSchema,
	})
	.meta({
		id: "EditorProjectGameFileSchema",
		description: "The game.json contract excluding items owned by items/<type> files.",
	});

export type EditorProjectGameFileSchema = typeof EditorProjectGameFileSchema;

export namespace EditorProjectGameFileSchema {
	export type Type = z.infer<EditorProjectGameFileSchema>;
}
