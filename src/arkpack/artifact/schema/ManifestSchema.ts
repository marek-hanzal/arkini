import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";
import { ManifestResourceSchema } from "./ManifestResourceSchema";
import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { ArkpackVersionSchema } from "~/game-version/schema/ArkpackVersionSchema";

export const ManifestSchema = z
	.object({
		version: ArkpackVersionSchema.describe("The gameplay compatibility version."),
		arkini: ArkiniVersionSchema.describe("The Arkini version that built this package."),
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
