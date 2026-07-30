import { z } from "zod";

import { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";

export const EditorProjectCompilationSchema = z
	.object({
		payload: PayloadSchema,
		diagnostics: GameDiagnosticsSchema,
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
