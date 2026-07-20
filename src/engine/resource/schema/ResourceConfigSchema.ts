import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/**
 * Explicit non-item resources used by the game runtime or presentation shell.
 *
 * Item visuals remain declared on each item. This root config owns only named
 * non-item roles such as the splash hero and capability icons so no filesystem convention is needed.
 */
export const ResourceConfigSchema = z
	.object({
		hero: IdSchema.describe("The explicit resource ID used by the game splash hero."),
		tileCapabilities: z
			.object({
				info: IdSchema,
				status: IdSchema,
				lines: IdSchema,
				effects: IdSchema,
			})
			.strict()
			.optional()
			.describe(
				"Explicit Arkpack resource IDs for the initial tile capability action icons.",
			),
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
