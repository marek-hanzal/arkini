import { z } from "zod";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";

export const GameCompilationResultSchema = z
	.object({
		config: GameConfigSchema.optional(),
		diagnostics: GameDiagnosticsSchema,
		provenance: GameSourceProvenanceSchema,
	})
	.strict()
	.meta({
		id: "GameCompilationResultSchema",
		description:
			"The completed config, diagnostics, and source provenance from one compile pass.",
	});

export type GameCompilationResultSchema = typeof GameCompilationResultSchema;

export namespace GameCompilationResultSchema {
	export type Type = z.infer<GameCompilationResultSchema>;
}
