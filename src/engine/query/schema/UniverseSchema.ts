import { z } from "zod";

import { BaseSchema } from "./BaseSchema";
import { ScopeSchema } from "./ScopeSchema";

/**
 * A query that searches every board space plus both passive storage surfaces.
 *
 * It intentionally has no distance because candidates may belong to different
 * board spaces or have no board position at all.
 */
export const UniverseSchema = z
	.object({
		...BaseSchema.shape,
		scope: ScopeSchema.extract([
			"Universe",
		]).describe("Searches every board space plus both passive storage surfaces."),
	})
	.strict()
	.meta({
		id: "query.UniverseSchema",
		description:
			"A universe-wide item query across every board space and both passive storage surfaces without distance.",
	});

export type UniverseSchema = typeof UniverseSchema;

export namespace UniverseSchema {
	export type Type = z.infer<UniverseSchema>;
}
