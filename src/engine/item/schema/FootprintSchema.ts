import { z } from "zod";

import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

/**
 * The rectangular Board area occupied by one canonical item definition.
 *
 * Runtime item instances keep only their anchor; the effective footprint is
 * always read from the canonical definition.
 */
export const FootprintSchema = z
	.object({
		width: PositiveIntegerSchema.describe(
			"The positive number of Board cells occupied horizontally.",
		),
		height: PositiveIntegerSchema.describe(
			"The positive number of Board cells occupied vertically.",
		),
	})
	.strict()
	.meta({
		id: "FootprintSchema",
		description: "The positive rectangular Board footprint of one canonical item.",
	});

export type FootprintSchema = typeof FootprintSchema;

export namespace FootprintSchema {
	export type Type = z.infer<FootprintSchema>;
}
