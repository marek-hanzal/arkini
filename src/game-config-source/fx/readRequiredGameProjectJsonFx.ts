import { Effect, FileSystem } from "effect";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

/** Reads one required project metadata file and delegates validation of its JSON value. */
export const readRequiredGameProjectJsonFx = Effect.fn("readRequiredGameProjectJsonFx")(function* ({
	path,
	missingIssueCode,
	missingMessage,
	validate,
}: {
	readonly path: string;
	readonly missingIssueCode: string;
	readonly missingMessage: string;
	readonly validate: (json: unknown) => GameDiagnosticsSchema.Type;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const source = yield* Effect.option(fileSystem.readFileString(path));
	if (source._tag === "None")
		return [
			{
				code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
				severity: DiagnosticSeverityEnumSchema.enum.Error,
				path: [],
				source: path,
				message: missingMessage,
				issueCode: missingIssueCode,
			},
		] satisfies GameDiagnosticsSchema.Type;
	return yield* Effect.sync(() => {
		try {
			return validate(JSON.parse(source.value));
		} catch (error) {
			return [
				{
					code: DiagnosticCodeEnumSchema.enum.SourceJsonInvalid,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: [],
					source: path,
					message: error instanceof Error ? error.message : "Invalid JSON syntax.",
				},
			] satisfies GameDiagnosticsSchema.Type;
		}
	});
});
