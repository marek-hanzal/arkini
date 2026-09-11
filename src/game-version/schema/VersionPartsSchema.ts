import { z } from "zod";

const VersionNumberSchema = z.number().int().nonnegative().safe();

/** Canonical project-owned gameplay version parts. */
export const VersionPartsSchema = z
	.object({
		major: VersionNumberSchema,
		minor: VersionNumberSchema,
		suffix: z
			.string()
			.regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/)
			.optional(),
	})
	.strict()
	.meta({
		id: "VersionPartsSchema",
		description: "The structured project-owned gameplay version.",
	});

export type VersionPartsSchema = typeof VersionPartsSchema;

export namespace VersionPartsSchema {
	export type Type = z.infer<VersionPartsSchema>;
}
