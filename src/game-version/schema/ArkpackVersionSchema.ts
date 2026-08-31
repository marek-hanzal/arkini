import { z } from "zod";

/** Project-owned gameplay compatibility version in `<major>.<minor>` form. */
export const ArkpackVersionSchema = z
	.string()
	.regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "Expected an arkpack version like 1.0.")
	.meta({
		id: "ArkpackVersionSchema",
		description: "The arkpack gameplay compatibility version.",
	});

export type ArkpackVersionSchema = typeof ArkpackVersionSchema;

export namespace ArkpackVersionSchema {
	export type Type = z.infer<ArkpackVersionSchema>;
}
