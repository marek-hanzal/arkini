import { z } from "zod";

const portablePathSegmentPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const windowsDeviceNamePattern = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

export const EditorSourceFileSchema = z
	.object({
		path: z
			.string()
			.min(1)
			.max(512)
			.refine(
				(value) =>
					value
						.split("/")
						.every(
							(segment) =>
								portablePathSegmentPattern.test(segment) &&
								!segment.endsWith(".") &&
								!windowsDeviceNamePattern.test(segment),
						) && /(?:^|\/).+\.(?:json|png)$/.test(value),
				{
					message:
						"Editor source path must be a portable project-relative JSON or PNG path.",
				},
			),
		bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
	})
	.strict()
	.meta({
		id: "EditorSourceFileSchema",
		description: "One portable project-relative editor source file.",
	});

export type EditorSourceFileSchema = typeof EditorSourceFileSchema;

export namespace EditorSourceFileSchema {
	export type Type = z.infer<EditorSourceFileSchema>;
}
