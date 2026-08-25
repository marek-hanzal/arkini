import { z } from "zod";

export const EditorProjectVersionSubjectSchema = z.string().trim().min(1).max(120);
export const EditorProjectVersionBodySchema = z.string().trim().min(1).max(4_000);
export const EditorProjectVersionTagSchema = z
	.string()
	.trim()
	.min(1)
	.max(80)
	.refine((value) => !/[\r\n]/.test(value), "Version tags must use one line.");

export const EditorProjectSnapshotFormatVersion = 1;
