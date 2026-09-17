import { Effect, FileSystem, Path } from "effect";

import { collectSourceFilesFx } from "~/game-config-source/fx/collectSourceFilesFx";
import { readGameProjectManifestFx } from "~/game-config-source/fx/readGameProjectManifestFx";
import { readGameProjectSchemaFx } from "~/game-config-source/fx/readGameProjectSchemaFx";
import { parseGameSourceFileFx } from "~/game-config-source/fx/parseGameSourceFileFx";
import {
	GameProjectManifestFileName,
	GameProjectSchemaFileName,
} from "~/game-config-source/constant/GameProjectReference";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import type { GameDiagnosticsSchema } from "~/game-config-diagnostic/schema/GameDiagnosticsSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { AudioResourceMetadataSchema } from "~/audio-authoring/schema/AudioResourceMetadataSchema";
import { readRequiredGameProjectJsonFx } from "~/game-config-source/fx/readRequiredGameProjectJsonFx";
import { gameSourceSchemaDiagnosticsFn } from "~/game-config-source/fn/gameSourceSchemaDiagnosticsFn";

export namespace readGameSourceFilesFx {
	export interface Props {
		input: string;
	}
}

const readGameSourceFileFx = Effect.fn("readGameSourceFileFx")(function* ({
	path,
	relative,
}: {
	readonly path: string;
	readonly relative: string;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	return yield* parseGameSourceFileFx({
		path,
		relative,
		source: yield* fileSystem.readFileString(path),
	});
});

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
	const audioPaths = new Set(
		sourceFiles.resources
			.filter(({ type }) => type === "music" || type === "sfx")
			.map(({ path }) => path),
	);
	const metadataPaths = new Set([
		...sourceFiles.audioMetadata,
		...Array.from(audioPaths, (path) => `${path.slice(0, -4)}.json`),
	]);
	for (const metadataPath of [
		...metadataPaths,
	].sort()) {
		const audioPath = `${metadataPath.slice(0, -5)}.ogg`;
		if (!audioPaths.has(audioPath))
			diagnostics.push({
				code: DiagnosticCodeEnumSchema.enum.SourceSchemaInvalid,
				severity: DiagnosticSeverityEnumSchema.enum.Error,
				path: [],
				source: metadataPath,
				message: `Audio metadata requires its paired file ${audioPath}.`,
				issueCode: "audio-resource-body-missing",
			});
		diagnostics.push(
			...(yield* readRequiredGameProjectJsonFx({
				path: metadataPath,
				missingIssueCode: "audio-resource-metadata-missing",
				missingMessage: `Audio resource ${audioPath} requires metadata ${metadataPath}.`,
				validateFn: (json) => {
					const result = AudioResourceMetadataSchema.safeParse(json);
					return result.success
						? []
						: gameSourceSchemaDiagnosticsFn(metadataPath, result.error);
				},
			})),
		);
	}
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
