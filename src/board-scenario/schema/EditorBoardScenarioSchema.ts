import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";
import { TitleSchema } from "~/game-config/schema/TitleSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

export const EditorBoardScenarioNameSchema = TitleSchema.max(80);

export const EditorBoardScenarioDescriptorSchema = z
	.object({
		projectId: IdSchema,
		name: EditorBoardScenarioNameSchema,
		projectRevision: z.number().int().nonnegative(),
		version: GameVersionSchema,
		createdAtMs: z.number().int().nonnegative(),
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict();

export const EditorBoardScenarioSchema = EditorBoardScenarioDescriptorSchema.extend({
	bytes: z.instanceof(Uint8Array),
}).strict();

export type EditorBoardScenarioDescriptorSchema = typeof EditorBoardScenarioDescriptorSchema;
export namespace EditorBoardScenarioDescriptorSchema {
	export type Type = z.infer<EditorBoardScenarioDescriptorSchema>;
}

export type EditorBoardScenarioSchema = typeof EditorBoardScenarioSchema;
export namespace EditorBoardScenarioSchema {
	export type Type = z.infer<EditorBoardScenarioSchema>;
}
