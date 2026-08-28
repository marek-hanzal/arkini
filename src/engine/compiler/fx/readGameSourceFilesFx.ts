import { Effect, Path } from "effect";

import { collectSourceFilesFx } from "~/engine/source/fx/collectSourceFilesFx";
import { readGameProjectManifestFx } from "~/engine/source/fx/readGameProjectManifestFx";
import { readGameProjectSchemaFx } from "~/engine/source/fx/readGameProjectSchemaFx";
import { readGameSourceFileFx } from "~/engine/source/fx/readGameSourceFileFx";
import {
	GameProjectManifestFileName,
	GameProjectSchemaFileName,
} from "~/engine/source/GameProjectReference";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import type { GameDiagnosticsSchema } from "~/engine/validation/schema/GameDiagnosticsSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

export namespace readGameSourceFilesFx {
	export interface Props {
		input: string;
	}
}

/** Reads every JSON game source while collecting malformed-source diagnostics. */
export const readGameSourceFilesFx = Effect.fn("readGameSourceFilesFx")(function* ({
	input,
}: readGameSourceFilesFx.Props) {
	const sourceFiles = yield* collectSourceFilesFx({
		input,
	});
	const pathService = yield* Path.Path;
	const projectGame = pathService.join(sourceFiles.root, "game.json");
	const manifestDiagnostics = yield* readGameProjectManifestFx(
		pathService.join(sourceFiles.root, GameProjectManifestFileName),
	);
	const schemaDiagnostics = yield* readGameProjectSchemaFx(
		pathService.join(sourceFiles.root, GameProjectSchemaFileName),
	);
	const results = yield* Effect.forEach(sourceFiles.json, (path) =>
		readGameSourceFileFx({
			path,
			relative: pathService.relative(sourceFiles.root, path).replaceAll("\\", "/"),
		}),
	);
	const diagnostics: GameDiagnosticsSchema.Type = [
		...manifestDiagnostics,
		...schemaDiagnostics,
		...(sourceFiles.json.includes(projectGame)
			? []
			: [
					{
						code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
						severity: DiagnosticSeverityEnumSchema.enum.Error,
						path: [],
						source: projectGame,
						message: "The required game.json root could not be read.",
						issueCode: "game-project-root-missing",
					},
				]),
	];
	const sources = [];
	let projectIdentity;
	for (const result of results) {
		diagnostics.push(...result.diagnostics);
		if (result.source !== undefined) sources.push(result.source);
		if (result.projectIdentity !== undefined) projectIdentity = result.projectIdentity;
	}

	return {
		root: sourceFiles.root,
		sources,
		diagnostics,
		projectIdentity,
	} as const;
});
