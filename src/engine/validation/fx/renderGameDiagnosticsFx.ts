import { Console, Effect } from "effect";

import type { GameDiagnosticSchema } from "../schema/GameDiagnosticSchema";
import { formatGameDiagnosticFx } from "./formatGameDiagnosticFx";

/** Renders already-computed diagnostics for Effect CLI commands. */
export const renderGameDiagnosticsFx = Effect.fn("renderGameDiagnosticsFx")(function* (
	diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>,
) {
	for (const diagnostic of diagnostics) {
		const message = yield* formatGameDiagnosticFx(diagnostic);
		if (diagnostic.severity === "warning") {
			yield* Console.warn(message);
		} else {
			yield* Console.error(message);
		}
	}
});
