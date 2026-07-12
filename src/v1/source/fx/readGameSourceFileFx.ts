import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

import type { DiagnosticPathSchema } from "~/v1/validation/schema/DiagnosticPathSchema";
import type { GameDiagnosticsSchema } from "~/v1/validation/schema/GameDiagnosticsSchema";
import { GameSourceFileSchema } from "~/v1/source/schema/GameSourceFileSchema";
import { GameSourceSchema } from "~/v1/schema/GameSourceSchema";

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
					code: "source:json-invalid",
					severity: "error",
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
				code: "source:schema-invalid",
				severity: "error",
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
