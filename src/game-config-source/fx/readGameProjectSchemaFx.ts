import { isDeepStrictEqual } from "node:util";
import { Effect } from "effect";

import { GameProjectJsonSchema } from "~/game-project-json-schema/schema/GameProjectJsonSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
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
			isDeepStrictEqual(json, GameProjectJsonSchema)
				? []
				: ([
						{
							code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: [],
							source: path,
							message:
								"The game project schema does not match the current project schema.",
							issueCode: "game-project-schema-mismatch",
						},
					] satisfies GameDiagnosticsSchema.Type),
	});
});
