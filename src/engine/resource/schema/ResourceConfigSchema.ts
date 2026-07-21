import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/**
 * Explicit non-item resources used by the game runtime or presentation shell.
 *
 * Item visuals remain declared on each item. This root config owns only named
 * non-item roles such as the splash hero so no filesystem convention is needed.
 */
export const ResourceConfigSchema = z
	.object({
		hero: IdSchema.describe("The explicit resource ID used by the game splash hero."),
		"avatar-01": IdSchema.optional(),
		"avatar-02": IdSchema.optional(),
		"avatar-03": IdSchema.optional(),
		"avatar-04": IdSchema.optional(),
		"avatar-05": IdSchema.optional(),
	})
	.strict()
	.meta({
		id: "ResourceConfigSchema",
		description: "Named non-item resource references required by the game.",
	});

export type ResourceConfigSchema = typeof ResourceConfigSchema;

export namespace ResourceConfigSchema {
	export type Type = z.infer<ResourceConfigSchema>;
}
