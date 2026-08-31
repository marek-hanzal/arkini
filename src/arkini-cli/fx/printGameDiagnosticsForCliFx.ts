import { Console, Effect } from "effect";

import type { GameDiagnosticSchema } from "~/game-config-diagnostic/schema/GameDiagnosticSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { readGameDiagnosticPresentationFn } from "~/game-config-diagnostic/fn/readGameDiagnosticPresentationFn";

const printGameDiagnosticForCliFn = (diagnostic: GameDiagnosticSchema.Type) => {
	const presentation = readGameDiagnosticPresentationFn(diagnostic);
	const location = [
		diagnostic.source,
		diagnostic.path.length > 0 ? diagnostic.path.join(".") : undefined,
	]
		.filter((value) => value !== undefined)
		.join(":");
	const heading = `${diagnostic.severity.toUpperCase()} ${diagnostic.code} — ${presentation.title}`;
	const context = presentation.context === undefined ? "" : ` [${presentation.context}]`;
	const suffix = location.length === 0 ? "" : ` (${location})`;

	return `${heading}${context}${suffix}\n  ${presentation.detail}`;
};

/** Prints canonical diagnostics for CLI consumers without changing their data contract. */
export const printGameDiagnosticsForCliFx = Effect.fn("printGameDiagnosticsForCliFx")(function* (
	diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>,
) {
	for (const diagnostic of diagnostics) {
		const message = printGameDiagnosticForCliFn(diagnostic);
		if (diagnostic.severity === DiagnosticSeverityEnumSchema.enum.Warning) {
			yield* Console.warn(message);
		} else {
			yield* Console.error(message);
		}
	}
});
