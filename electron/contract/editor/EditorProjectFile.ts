import { z } from "zod";

/** One project-relative editor source file transported through the preload boundary. */
export const EditorProjectFileSchema = z
	.object({
		path: z.string().min(1).max(512),
		bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
	})
	.strict();

export type EditorProjectFile = z.infer<typeof EditorProjectFileSchema>;
