import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

const windowsDeviceNamePattern = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

/** One portable filesystem segment identifying a local editor workspace. */
export const EditorProjectIdSchema = IdSchema.regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/)
	.refine((value) => value !== "." && value !== ".." && !value.endsWith("."))
	.refine((value) => !windowsDeviceNamePattern.test(value))
	.meta({
		id: "EditorProjectIdSchema",
		description: "A portable filesystem segment identifying one local editor workspace.",
	});

export type EditorProjectIdSchema = typeof EditorProjectIdSchema;

export namespace EditorProjectIdSchema {
	export type Type = z.infer<EditorProjectIdSchema>;
}
