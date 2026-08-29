import { z } from "zod";

import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { GameDiagnosticsSchema } from "~/game-config/diagnostic/schema/GameDiagnosticsSchema";
import { GameSourceProvenanceSchema } from "~/game-config/source/schema/GameSourceProvenanceSchema";

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
