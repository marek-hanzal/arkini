import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { ManifestResourceSchema } from "./ManifestResourceSchema";
import { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

export const ManifestSchema = z
	.object({
		version: GameVersionSchema.describe("The gameplay compatibility version."),
		serakki: SerakkiVersionSchema.describe("The Serakki version that built this package."),
		projectRevision: NonNegativeIntegerSchema.describe(
			"The source project revision used for this build.",
		),
		length: NonNegativeIntegerSchema.describe("The encoded configuration size in bytes."),
		resources: z
			.array(ManifestResourceSchema)
			.describe("The ordered binary resource manifest."),
	})
	.strict()
	.meta({
		id: "ManifestSchema",
		description: "The binary layout manifest stored at the start of a game pack.",
	});

export type ManifestSchema = typeof ManifestSchema;

export namespace ManifestSchema {
	export type Type = z.infer<ManifestSchema>;
}
