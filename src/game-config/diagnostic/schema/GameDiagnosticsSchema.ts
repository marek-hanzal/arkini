import { z } from "zod";

import { GameDiagnosticSchema } from "./GameDiagnosticSchema";

export const GameDiagnosticsSchema = z.array(GameDiagnosticSchema).meta({
	id: "GameDiagnosticsSchema",
	description: "All structured diagnostics produced by one completed-game validation pass.",
});

export type GameDiagnosticsSchema = typeof GameDiagnosticsSchema;

export namespace GameDiagnosticsSchema {
	export type Type = z.infer<GameDiagnosticsSchema>;
}
