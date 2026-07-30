import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { TitleSchema } from "~/engine/common/schema/TitleSchema";
import { VersionEnumSchema } from "~/engine/schema/VersionEnumSchema";

export const ArkpackMetadataSchema = z
	.object({
		packageId: IdSchema,
		hash: z
			.string()
			.regex(/^[a-f0-9]{64}$/)
			.describe(
				"The lowercase SHA-256 digest of the exact compressed .arkpack file bytes.",
			),
		gameId: IdSchema,
		title: TitleSchema,
		game: VersionEnumSchema,
	})
	.strict()
	.meta({
		id: "ArkpackMetadataSchema",
		description: "Metadata generated beside one packaged Arkini binary.",
	});

export type ArkpackMetadataSchema = typeof ArkpackMetadataSchema;

export namespace ArkpackMetadataSchema {
	export type Type = z.infer<ArkpackMetadataSchema>;
}
