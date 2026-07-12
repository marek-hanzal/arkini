import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { NonEmptyStringSchema } from "~/v1/common/schema/NonEmptyStringSchema";
import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";

export const ManifestResourceSchema = z
	.object({
		id: IdSchema.describe("The stable resource identifier."),
		mime: NonEmptyStringSchema.describe("The MIME type of the resource bytes."),
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
