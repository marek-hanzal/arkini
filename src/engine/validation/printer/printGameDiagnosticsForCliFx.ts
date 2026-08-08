import { Console, Effect } from "effect";

import type { GameDiagnosticSchema } from "~/engine/validation/schema/GameDiagnosticSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { printGameDiagnosticForCli } from "./printGameDiagnosticForCli";

/** Prints canonical diagnostics for CLI consumers without changing their data contract. */
export const printGameDiagnosticsForCliFx = Effect.fn("printGameDiagnosticsForCliFx")(function* (
	diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>,
) {
	for (const diagnostic of diagnostics) {
		const message = printGameDiagnosticForCli(diagnostic);
		if (diagnostic.severity === DiagnosticSeverityEnumSchema.enum.Warning) {
			yield* Console.warn(message);
		} else {
			yield* Console.error(message);
		}
	}
});
