import { Effect } from "effect";

import type { GameDiagnosticSchema } from "../schema/GameDiagnosticSchema";

/** Formats one structured diagnostic without owning any validation rule. */
export const formatGameDiagnosticFx = Effect.fn("formatGameDiagnosticFx")(function* (
	diagnostic: GameDiagnosticSchema.Type,
) {
	const location = [
		diagnostic.source,
		diagnostic.path.length > 0 ? diagnostic.path.join(".") : undefined,
	]
		.filter((value) => value !== undefined)
		.join(":");
	const prefix = `${diagnostic.severity.toUpperCase()} ${diagnostic.code}`;

	return location.length > 0
		? `${prefix} ${location} — ${diagnostic.message}`
		: `${prefix} — ${diagnostic.message}`;
});
