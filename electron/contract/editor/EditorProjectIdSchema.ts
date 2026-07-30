import { z } from "zod";

const windowsDeviceNamePattern = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

export const EditorProjectIdSchema = z
	.string()
	.regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/)
	.refine((value) => value !== "." && value !== ".." && !value.endsWith("."))
	.refine((value) => !windowsDeviceNamePattern.test(value));

export type EditorProjectIdSchema = typeof EditorProjectIdSchema;

export namespace EditorProjectIdSchema {
	export type Type = z.infer<EditorProjectIdSchema>;
}
