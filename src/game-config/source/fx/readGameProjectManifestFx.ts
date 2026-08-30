import { Effect } from "effect";

import { GameProjectManifestSchema } from "~/game-config/source/schema/GameProjectManifestSchema";
import { readArkiniVersionIncompatibilityFn } from "~/application-version/fn/readArkiniVersionIncompatibilityFn";
import { DiagnosticCodeEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config/diagnostic/schema/DiagnosticSeverityEnumSchema";
import { gameSourceSchemaDiagnosticsFn } from "~/game-config/source/fn/gameSourceSchemaDiagnosticsFn";
import { readRequiredGameProjectJsonFx } from "./readRequiredGameProjectJsonFx";

/** Validates the manifest that selects the portable game-project source format. */
export const readGameProjectManifestFx = Effect.fn("readGameProjectManifestFx")(function* (
	path: string,
) {
	return yield* readRequiredGameProjectJsonFx({
		path,
		missingIssueCode: "game-project-manifest-missing",
		missingMessage: "The required game project manifest could not be read.",
		validate: (json) => {
			const parsed = GameProjectManifestSchema.safeParse(json);
			if (!parsed.success) return gameSourceSchemaDiagnosticsFn(path, parsed.error);
			const incompatibility = readArkiniVersionIncompatibilityFn(
				"Editor project",
				parsed.data.arkini,
			);
			return incompatibility === undefined
				? []
				: [
						{
							code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
							severity: DiagnosticSeverityEnumSchema.enum.Error,
							path: [
								"arkini",
							],
							source: path,
							message: incompatibility.message,
							issueCode: "arkini-version-incompatible",
						},
					];
		},
	});
});
