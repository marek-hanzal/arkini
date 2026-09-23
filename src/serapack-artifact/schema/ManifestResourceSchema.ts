import { z } from "zod";

import { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

export const ManifestResourceSchema = z
	.object({
		uid: IdSchema.describe("The stable resource identifier."),
		type: ResourceTypeSchema.describe("The semantic resource kind."),
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
