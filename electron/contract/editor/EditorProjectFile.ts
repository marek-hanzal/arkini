import { z } from "zod";

/** One project-relative editor source file transported through the preload boundary. */
export const EditorProjectFileSchema = z
	.object({
		path: z
			.string()
			.min(1)
			.max(512)
			.describe("The portable project-relative JSON or PNG path."),
		bytes: z
			.custom<Uint8Array>((value) => value instanceof Uint8Array)
			.describe("The exact file bytes."),
	})
	.strict()
	.meta({
		id: "EditorProjectFileSchema",
		description: "One editor source file crossing the trusted preload boundary.",
	});

export type EditorProjectFile = z.infer<typeof EditorProjectFileSchema>;
