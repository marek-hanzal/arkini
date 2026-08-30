import { z } from "zod";

/** Complete Arkini writer provenance with an optional SemVer prerelease suffix. */
export const ArkiniVersionSchema = z
	.string()
	.regex(
		/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
		"Expected an Arkini version like 1.0.0 or 1.0.0-dev.1.",
	)
	.meta({
		id: "ArkiniVersionSchema",
		description:
			"The complete Arkini version, including an optional prerelease suffix, that wrote persisted data.",
	});

export type ArkiniVersionSchema = typeof ArkiniVersionSchema;

export namespace ArkiniVersionSchema {
	export type Type = z.infer<ArkiniVersionSchema>;
}
