import { Effect, FileSystem, PlatformError } from "effect";

import { createEditorProjectFilesystemPathsFx } from "../../../../electron/main/editor-project/filesystem/createEditorProjectFilesystemPathsFx";
import { readFilesystemEditorProjectFilesFx } from "../../../../electron/main/editor-project/filesystem/fx/readFilesystemEditorProjectFilesFx";
import { readFilesystemEditorProjectSidecarsFx } from "../../../../electron/main/editor-project/filesystem/fx/readFilesystemEditorProjectSidecarsFx";
import { readFilesystemEditorProjectVersionHistoryFx } from "../../../../electron/main/editor-project/filesystem/fx/readFilesystemEditorProjectVersionHistoryFx";
import { writeFilesystemEditorProjectFilesFx } from "../../../../electron/main/editor-project/filesystem/fx/writeFilesystemEditorProjectFilesFx";
import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import { GameProjectManifestSchema } from "~/engine/source/schema/GameProjectManifestSchema";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

export const filesystemFailure = (method: string) =>
	PlatformError.systemError({
		_tag: "Unknown",
		description: `${method} failed`,
		method,
		module: "FileSystem",
	});

export const writeReimportableProjectFx = (root: string, revision: number) =>
	writeFilesystemEditorProjectFilesFx({
		root,
		next: {
			arkpack: editorTestPayload.version,
			config: editorTestPayload.config,
			marker: GameProjectManifestSchema.parse({
				arkini: ArkiniAppVersion,
				revision,
			}),
			resources: editorTestPayload.resources,
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
	const paths = yield* createEditorProjectFilesystemPathsFx(root);
	const project = yield* readFilesystemEditorProjectFilesFx(root);
	yield* readFilesystemEditorProjectSidecarsFx({
		paths,
		projectId: project.config.meta.id,
	});
	yield* readFilesystemEditorProjectVersionHistoryFx(paths);
	return project;
});

export const readSortedDirectoryFx = (root: string) =>
	Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		return (yield* fileSystem.readDirectory(root)).sort();
	});
