import { z } from "zod";

/** Lowercase SHA-256 address of one immutable full version object. */
export const VersionObjectHashSchema = z
	.string()
	.regex(/^[a-f0-9]{64}$/, "Expected a lowercase SHA-256 content hash.")
	.meta({
		id: "EditorObjectHashSchema",
		description: "The content address of one immutable full Editor version object.",
	});

export type VersionObjectHashSchema = typeof VersionObjectHashSchema;

export namespace VersionObjectHashSchema {
	export type Type = z.infer<VersionObjectHashSchema>;
}
