import { z } from "zod";

const VersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([A-Za-z0-9][A-Za-z0-9.-]*))?$/;

/** External gameplay compatibility provenance in canonical string form. */
export const VersionSchema = z
	.string()
	.regex(VersionPattern, "Expected a gameplay version like 1.0 or 1.0-preview.1.")
	.refine((version) => {
		const match = VersionPattern.exec(version);
		return (
			match !== null &&
			Number.isSafeInteger(Number(match[1])) &&
			Number.isSafeInteger(Number(match[2]))
		);
	}, "Version components must be safe non-negative integers.")
	.meta({
		id: "ArkpackVersionSchema",
		description: "The arkpack gameplay compatibility version.",
	});

export type VersionSchema = typeof VersionSchema;

export namespace VersionSchema {
	export type Type = z.infer<VersionSchema>;
}
