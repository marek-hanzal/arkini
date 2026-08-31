import { z } from "zod";

/** Project-owned gameplay compatibility version in `<major>.<minor>` form. */
export const VersionSchema = z
	.string()
	.regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "Expected an arkpack version like 1.0.")
	.meta({
		id: "ArkpackVersionSchema",
		description: "The arkpack gameplay compatibility version.",
	});

export type VersionSchema = typeof VersionSchema;

export namespace VersionSchema {
	export type Type = z.infer<VersionSchema>;
}
