import { z } from "zod";

import { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";

export const EditorProjectCompilationSchema = z
	.object({
		payload: PayloadSchema,
		diagnostics: GameDiagnosticsSchema,
		provenance: GameSourceProvenanceSchema.describe(
			"The source file owning each compiled project definition.",
		),
		resourcePaths: z
			.record(z.string(), z.string())
			.describe("The source PNG path owning each compiled resource."),
	})
	.strict()
	.meta({
		id: "EditorProjectCompilationSchema",
		description: "A compiled editor workspace payload and its non-blocking diagnostics.",
	});

export type EditorProjectCompilationSchema = typeof EditorProjectCompilationSchema;

export namespace EditorProjectCompilationSchema {
	export type Type = z.infer<EditorProjectCompilationSchema>;
}
