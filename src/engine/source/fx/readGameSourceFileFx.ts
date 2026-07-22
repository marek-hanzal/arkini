import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

import type { DiagnosticPathSchema } from "~/engine/validation/schema/DiagnosticPathSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { GameSourceFileSchema } from "~/engine/source/schema/GameSourceFileSchema";
import { GameSourceSchema } from "~/engine/schema/GameSourceSchema";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

export namespace readGameSourceFileFx {
	export interface Props {
		path: string;
	}

	export interface Result {
		source?: GameSourceFileSchema.Type;
		diagnostics: GameDiagnosticsSchema.Type;
	}
}

const parseGameSourceFile = (path: string, source: string): readGameSourceFileFx.Result => {
	let json: unknown;
	try {
		json = JSON.parse(source);
	} catch (error) {
		return {
			diagnostics: [
				{
					code: DiagnosticCodeEnumSchema.enum.SourceJsonInvalid,
					severity: DiagnosticSeverityEnumSchema.enum.Error,
					path: [],
					source: path,
					message: error instanceof Error ? error.message : "Invalid JSON syntax.",
				},
			],
		};
	}

	const parsed = GameSourceSchema.safeParse(json);
	if (!parsed.success) {
		return {
			diagnostics: parsed.error.issues.map((issue) => ({
				code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
				severity: DiagnosticSeverityEnumSchema.enum.Error,
				path: issue.path.map((segment) =>
					typeof segment === "string" || typeof segment === "number"
						? segment
						: String(segment),
				) satisfies DiagnosticPathSchema.Type,
				source: path,
				message: issue.message,
				issueCode: issue.code,
			})),
		};
	}

	return {
		source: {
			path,
			value: parsed.data,
		},
		diagnostics: [],
	};
};

/** Parses one JSON authoring fragment and returns source-aware diagnostics on failure. */
export const readGameSourceFileFx = Effect.fn("readGameSourceFileFx")(function* ({
	path,
}: readGameSourceFileFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const source = yield* fileSystem.readFileString(path);
	return parseGameSourceFile(path, source);
});
