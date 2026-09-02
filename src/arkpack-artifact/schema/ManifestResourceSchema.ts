import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

export const ManifestResourceSchema = z
	.object({
		id: IdSchema.describe("The stable resource identifier."),
		length: NonNegativeIntegerSchema.describe("The resource payload size in bytes."),
	})
	.strict()
	.meta({
		id: "ManifestResourceSchema",
		description: "The manifest metadata for one embedded binary resource.",
	});

export type ManifestResourceSchema = typeof ManifestResourceSchema;

export namespace ManifestResourceSchema {
	export type Type = z.infer<ManifestResourceSchema>;
}
