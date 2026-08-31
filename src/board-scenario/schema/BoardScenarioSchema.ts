import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";
import { TitleSchema } from "~/game-config/schema/TitleSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

export const BoardScenarioNameSchema = TitleSchema.max(80);

export const BoardScenarioDescriptorSchema = z
	.object({
		projectId: IdSchema,
		name: BoardScenarioNameSchema,
		projectRevision: z.number().int().nonnegative(),
		version: GameVersionSchema,
		createdAtMs: z.number().int().nonnegative(),
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict();

export const BoardScenarioSchema = BoardScenarioDescriptorSchema.extend({
	bytes: z.instanceof(Uint8Array),
}).strict();

export type BoardScenarioDescriptorSchema = typeof BoardScenarioDescriptorSchema;
export namespace BoardScenarioDescriptorSchema {
	export type Type = z.infer<BoardScenarioDescriptorSchema>;
}

export type BoardScenarioSchema = typeof BoardScenarioSchema;
export namespace BoardScenarioSchema {
	export type Type = z.infer<BoardScenarioSchema>;
}
