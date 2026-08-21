import { Effect } from "effect";

import type { GameDiagnosticSchema } from "~/engine/validation/schema/GameDiagnosticSchema";
import { readGameDiagnosticPresentationFx } from "~/engine/validation/printer/readGameDiagnosticPresentationFx";

/** Prints one structured diagnostic for terminal consumption. */
export const printGameDiagnosticForCliFx = Effect.fnUntraced(function* (
	diagnostic: GameDiagnosticSchema.Type,
) {
	const presentation = yield* readGameDiagnosticPresentationFx(diagnostic);
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
});
