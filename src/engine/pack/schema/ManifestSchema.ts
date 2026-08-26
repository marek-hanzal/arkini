import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { ManifestResourceSchema } from "./ManifestResourceSchema";
import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

export const ManifestSchema = z
	.object({
		packageId: IdSchema.describe("The stable catalog identity of this package."),
		version: ArkpackVersionSchema.describe("The gameplay compatibility version."),
		game: ArkiniVersionSchema.describe("The Arkini version that built this package."),
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
