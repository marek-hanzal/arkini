import { z } from "zod";

/** Complete Serakki writer provenance with an optional SemVer prerelease suffix. */
export const SerakkiVersionSchema = z
	.string()
	.regex(
		/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
		"Expected an Serakki version like 1.0.0 or 1.0.0-dev.1.",
	)
	.meta({
		id: "SerakkiVersionSchema",
		description:
			"The complete Serakki version, including an optional prerelease suffix, that wrote persisted data.",
	});

export type SerakkiVersionSchema = typeof SerakkiVersionSchema;

export namespace SerakkiVersionSchema {
	export type Type = z.infer<SerakkiVersionSchema>;
}
