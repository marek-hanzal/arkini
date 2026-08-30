import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { TitleSchema } from "~/engine/common/schema/TitleSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

export const EditorBoardScenarioNameSchema = TitleSchema.max(80);

export const EditorBoardScenarioDescriptorSchema = z
	.object({
		projectId: IdSchema,
		name: EditorBoardScenarioNameSchema,
		projectRevision: z.number().int().nonnegative(),
		version: ArkpackVersionSchema,
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
