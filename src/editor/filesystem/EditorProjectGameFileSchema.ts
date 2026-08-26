import { z } from "zod";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Project-wide authored configuration stored separately from standalone item files. */
export const EditorProjectGameFileSchema = GameConfigSchema.omit({
	items: true,
}).meta({
	id: "EditorProjectGameFileSchema",
	description: "The game.json contract excluding items owned by items/<type> files.",
});

export type EditorProjectGameFileSchema = typeof EditorProjectGameFileSchema;

export namespace EditorProjectGameFileSchema {
	export type Type = z.infer<EditorProjectGameFileSchema>;
}
