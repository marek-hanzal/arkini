import { z } from "zod";

/** Arkini application version sourced from the root package manifest. */
export const ArkiniVersionSchema = z
	.string()
	.regex(
		/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
		"Expected an Arkini semantic version like 0.5.0.",
	)
	.meta({
		id: "ArkiniVersionSchema",
		description: "The Arkini application version that wrote a persisted artifact.",
	});

export type ArkiniVersionSchema = typeof ArkiniVersionSchema;

export namespace ArkiniVersionSchema {
	export type Type = z.infer<ArkiniVersionSchema>;
}
