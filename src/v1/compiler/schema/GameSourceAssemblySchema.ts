import { z } from "zod";

import { GameSourceSchema } from "~/v1/schema/GameSourceSchema";
import { GameDiagnosticSchema } from "~/v1/validation/schema/GameDiagnosticSchema";
import { GameSourceProvenanceSchema } from "./GameSourceProvenanceSchema";

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
