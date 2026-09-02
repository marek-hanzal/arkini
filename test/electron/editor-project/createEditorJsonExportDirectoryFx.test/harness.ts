import { Effect, FileSystem, PlatformError } from "effect";

import { createProjectPathsFx } from "~/project-authoring/filesystem/createProjectPathsFx";
import { readProjectFilesFx } from "~/project-authoring/filesystem/fx/readProjectFilesFx";
import { readSidecarsFx } from "~/project-authoring/filesystem/fx/readSidecarsFx";
import { readVersionHistoryFx } from "~/project-authoring/filesystem/fx/readVersionHistoryFx";
import { writeProjectFilesFx } from "~/project-authoring/filesystem/fx/writeProjectFilesFx";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { GameProjectManifestSchema } from "~/game-config-source/schema/GameProjectManifestSchema";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

export const filesystemFailure = (method: string) =>
	PlatformError.systemError({
		_tag: "Unknown",
		description: `${method} failed`,
		method,
		module: "FileSystem",
	});

export const writeReimportableProjectFx = (root: string, revision: number) =>
	writeProjectFilesFx({
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
	const paths = yield* createProjectPathsFx(root);
	const project = yield* readProjectFilesFx(root);
	yield* readSidecarsFx({
		paths,
		projectId: project.config.meta.id,
	});
	yield* readVersionHistoryFx(paths);
	return project;
});

export const readSortedDirectoryFx = (root: string) =>
	Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem;
		return (yield* fileSystem.readDirectory(root)).sort();
	});
