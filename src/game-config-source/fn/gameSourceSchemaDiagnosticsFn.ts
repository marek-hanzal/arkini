import type { ZodError } from "zod";

import type { DiagnosticPathSchema } from "~/game-config-diagnostic/schema/DiagnosticPathSchema";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

/** Projects one Zod failure into the canonical source diagnostics. */
export const gameSourceSchemaDiagnosticsFn = (
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
