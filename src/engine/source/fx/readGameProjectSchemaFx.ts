import { isDeepStrictEqual } from "node:util";
import { Effect } from "effect";

import { createGameProjectJsonSchema } from "~/engine/schema/fx/writeGameProjectJsonSchemaFx";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { readRequiredGameProjectJsonFx } from "./readRequiredGameProjectJsonFx";

/** Requires the project schema snapshot to match the engine-owned format exactly. */
export const readGameProjectSchemaFx = Effect.fn("readGameProjectSchemaFx")(function* (
	path: string,
) {
	return yield* readRequiredGameProjectJsonFx({
		path,
		missingIssueCode: "game-project-schema-missing",
		missingMessage: "The required game project schema could not be read.",
		validate: (json) =>
			isDeepStrictEqual(json, createGameProjectJsonSchema())
				? []
				: ([
						{
							code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: [],
							source: path,
							message: "The game project schema does not match this Arkini version.",
							issueCode: "game-project-schema-mismatch",
						},
					] satisfies GameDiagnosticsSchema.Type),
	});
});
