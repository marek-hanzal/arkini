import { z } from "zod";

/** Complete Arkini writer provenance in canonical `<major>.<minor>.<patch>` form. */
export const ArkiniVersionSchema = z
	.string()
	.regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "Expected an Arkini version like 1.0.0.")
	.meta({
		id: "ArkiniVersionSchema",
		description: "The complete Arkini version that wrote persisted data.",
	});

export type ArkiniVersionSchema = typeof ArkiniVersionSchema;

export namespace ArkiniVersionSchema {
	export type Type = z.infer<ArkiniVersionSchema>;
}
