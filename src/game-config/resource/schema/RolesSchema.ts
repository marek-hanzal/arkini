import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";

/**
 * Explicit non-item resources used by the game runtime or presentation shell.
 *
 * Item visuals remain declared on each item. This root config owns only named
 * non-item roles such as the splash hero so no filesystem convention is needed.
 */
export const RolesSchema = z
	.object({
		hero: IdSchema.describe("The explicit resource ID used by the game splash hero."),
		"avatar-01": IdSchema.optional(),
		"avatar-02": IdSchema.optional(),
		"avatar-03": IdSchema.optional(),
		"avatar-04": IdSchema.optional(),
		"avatar-05": IdSchema.optional(),
		"avatar-06": IdSchema.optional(),
		"avatar-07": IdSchema.optional(),
	})
	.strict()
	.meta({
		id: "resource.RolesSchema",
		description: "Named non-item resource references required by the game.",
	});

export type RolesSchema = typeof RolesSchema;

export namespace RolesSchema {
	export type Type = z.infer<RolesSchema>;
}
