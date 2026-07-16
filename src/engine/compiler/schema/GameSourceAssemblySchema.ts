import { z } from "zod";

import { GameSourceSchema } from "~/engine/schema/GameSourceSchema";
import { GameDiagnosticSchema } from "~/engine/validation/schema/GameDiagnosticSchema";
import { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";

export const GameSourceAssemblySchema = z
	.object({
		value: GameSourceSchema,
		diagnostics: z.array(GameDiagnosticSchema),
		provenance: GameSourceProvenanceSchema,
	})
	.strict()
	.meta({
		id: "GameSourceAssemblySchema",
		description: "The assembled source candidate, source diagnostics, and provenance.",
	});

export type GameSourceAssemblySchema = typeof GameSourceAssemblySchema;

export namespace GameSourceAssemblySchema {
	export type Type = z.infer<GameSourceAssemblySchema>;
}
