import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, FileSystem, PlatformError } from "effect";

import { replaceEditorJsonExportDirectoryFx } from "../../../../electron/main/editor-project/replaceEditorJsonExportDirectoryFx";
import { recoverEditorJsonExportsFx } from "../../../../electron/main/editor-project/recoverEditorJsonExportsFx";
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

export const readNodeFileSystem = () =>
	Effect.runPromise(FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)));

export const withEditorJsonExportPublishFailure = (
	fileSystem: FileSystem.FileSystem,
	target: string,
	overrides: Partial<FileSystem.FileSystem> = {},
): FileSystem.FileSystem => ({
	...fileSystem,
	...overrides,
	rename: (from, to) =>
		String(from).endsWith(".pending") && String(to) === target
			? Effect.fail(filesystemFailure("rename"))
			: fileSystem.rename(from, to),
});

export const writeReimportableProject = (root: string, revision: number) =>
	Effect.runPromise(
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
		}).pipe(Effect.provide(NodeServices.layer)),
	);

export const readReimportableProject = (root: string) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const paths = yield* createEditorProjectFilesystemPathsFx(root);
			const project = yield* readFilesystemEditorProjectFilesFx(root);
			yield* readFilesystemEditorProjectSidecarsFx({
				paths,
				projectId: project.config.meta.id,
			});
			yield* readFilesystemEditorProjectVersionHistoryFx(paths);
			return project;
		}).pipe(Effect.provide(NodeServices.layer)),
	);

export interface EditorJsonExportTestHarness {
	readonly recoveryRoot: string;
	readonly root: string;
	readonly source: string;
	readonly target: string;
	readonly close: () => Promise<void>;
	readonly recover: (fileSystem?: FileSystem.FileSystem) => Promise<void>;
	readonly replace: (fileSystem?: FileSystem.FileSystem) => Promise<{
		readonly json: number;
		readonly resources: number;
		readonly revision: number;
	}>;
}

export const createEditorJsonExportTestHarness = async () => {
	const root = await realpath(await mkdtemp(join(tmpdir(), "arkini-editor-export-safe-")));
	const recoveryRoot = join(root, "recovery");
	const source = join(root, "source");
	const target = join(root, "target");
	await mkdir(recoveryRoot);
	await writeReimportableProject(source, 2);
	const replace = async (fileSystem?: FileSystem.FileSystem) => {
		const selected = fileSystem ?? (await readNodeFileSystem());
		return Effect.runPromise(
			replaceEditorJsonExportDirectoryFx({
				recoveryRoot,
				source,
				target,
			}).pipe(
				Effect.provide(NodePath.layer),
				Effect.provideService(FileSystem.FileSystem, selected),
			),
		);
	};
	const recover = async (fileSystem?: FileSystem.FileSystem) => {
		const selected = fileSystem ?? (await readNodeFileSystem());
		return Effect.runPromise(
			recoverEditorJsonExportsFx(recoveryRoot).pipe(
				Effect.provide(NodePath.layer),
				Effect.provideService(FileSystem.FileSystem, selected),
			),
		);
	};
	return {
		close: () =>
			rm(root, {
				force: true,
				recursive: true,
			}),
		recoveryRoot,
		recover,
		replace,
		root,
		source,
		target,
	} satisfies EditorJsonExportTestHarness;
};
