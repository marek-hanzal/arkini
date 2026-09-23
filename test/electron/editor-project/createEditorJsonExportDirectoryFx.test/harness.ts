import { parseVersionFn } from "~/game-version/fn/parseVersionFn";
import { Effect, FileSystem, PlatformError } from "effect";

import { createProjectPathsFx } from "~/project-authoring/filesystem/createProjectPathsFx";
import { readProjectFilesFx } from "~/project-authoring/filesystem/fx/readProjectFilesFx";
import { readProjectNotesFx } from "~/project-authoring/filesystem/fx/readProjectNotesFx";
import { writeProjectFilesFx } from "~/project-authoring/filesystem/fx/writeProjectFilesFx";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { GameProjectManifestSchema } from "~/game-config-source/schema/GameProjectManifestSchema";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";

export const filesystemFailure = (method: string) =>
	PlatformError.systemError({
		_tag: "Unknown",
		description: `${method} failed`,
		method,
		module: "FileSystem",
	});

export const writeReimportableProjectFx = (root: string, revision: number, withAudio = false) =>
	writeProjectFilesFx({
		root,
		next: {
			serapack: parseVersionFn(editorTestPayload.version),
			config: editorTestPayload.config,
			marker: GameProjectManifestSchema.parse({
				serakki: SerakkiAppVersion,
				revision,
			}),
			resources: withAudio
				? [
						...editorTestPayload.resources,
						{
							uid: "unresolved-waltz",
							type: "music" as const,
							bytes: createTestOggOpusBytesFn(),
						},
						{
							uid: "job-start",
							type: "sfx" as const,
							bytes: createTestOggOpusBytesFn(),
						},
					]
				: editorTestPayload.resources,
		},
	});

export const writeExportSourceExtrasFx = Effect.fn("writeExportSourceExtrasFx")(function* (
	source: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	yield* Effect.all(
		[
			fileSystem.makeDirectory(`${source}/build`),
			fileSystem.makeDirectory(`${source}/notes`),
		],
		{
			discard: true,
		},
	);
	for (const directory of [
		"versions",
		"objects",
		"scenarios",
		".git",
	]) {
		yield* fileSystem.makeDirectory(`${source}/${directory}`);
		yield* fileSystem.writeFileString(`${source}/${directory}/ignored.json`, "unrelated bytes");
	}
	yield* Effect.all(
		[
			fileSystem.writeFileString(
				`${source}/notes/note-one.json`,
				'{"content":"kept","createdAtMs":1,"updatedAtMs":1}',
			),
			fileSystem.writeFileString(`${source}/build/derived.json`, "{}"),
			fileSystem.writeFileString(`${source}/game.json.tmp`, "transient"),
			fileSystem.writeFileString(`${source}/unrelated.json`, "{}"),
			fileSystem.writeFileString(`${source}/.gitignore`, "custom/\n"),
		],
		{
			concurrency: "unbounded",
			discard: true,
		},
	);
});

export const readReimportableProjectFx = Effect.fn("readReimportableProjectFx")(function* (
	root: string,
) {
	const paths = yield* createProjectPathsFx(root);
	const project = yield* readProjectFilesFx(root);
	yield* readProjectNotesFx({
		paths,
		projectId: project.config.meta.id,
	});
	return project;
});

export const readSortedDirectoryFx = (root: string) =>
	Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		return (yield* fileSystem.readDirectory(root)).sort();
	});
