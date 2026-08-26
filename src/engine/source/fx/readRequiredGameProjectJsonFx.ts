import { Effect, FileSystem } from "effect";
import type { ZodError } from "zod";

import type { DiagnosticPathSchema } from "~/engine/validation/schema/DiagnosticPathSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

export const gameSourceSchemaDiagnostics = (
	path: string,
	error: ZodError,
): GameDiagnosticsSchema.Type =>
	error.issues.map((issue) => ({
		code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
		severity: DiagnosticSeverityEnumSchema.enum.Error,
		path: issue.path.map((segment) =>
			typeof segment === "string" || typeof segment === "number" ? segment : String(segment),
		) satisfies DiagnosticPathSchema.Type,
		source: path,
		message: issue.message,
		issueCode: issue.code,
	}));

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
