import * as NodeServices from "@effect/platform-node/NodeServices";
import { app, dialog, type BrowserWindow } from "electron";
import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import type { OwnedEditorProjectRepository } from "./EditorProjectServiceOwnership";
import { withFilesystemEditorProjectLockFx } from "./filesystem/fx/withFilesystemEditorProjectLockFx";

export namespace exportEditorJsonDirectoryFx {
	export interface Props {
		readonly projectId: string;
		readonly repository: OwnedEditorProjectRepository;
		readonly window: BrowserWindow;
	}

	export interface Success {
		readonly json: number;
		readonly projectDirectory: string;
		readonly resources: number;
		readonly revision: number;
		readonly root: string;
	}
}

const containsPath = (path: Path.Path, parent: string, candidate: string) => {
	const relative = path.relative(parent, candidate);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const overlapsPath = (path: Path.Path, left: string, right: string) =>
	containsPath(path, left, right) || containsPath(path, right, left);

const assertSafeExportRootFx = Effect.fn("assertSafeExportRootFx")(function* ({
	source,
	target,
}: {
	readonly source: string;
	readonly target: string;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const resolved = yield* fileSystem.realPath(path.resolve(target));
	if (path.parse(resolved).root === resolved)
		return yield* Effect.fail(new Error("A filesystem root cannot be replaced by the Editor."));
	if (overlapsPath(path, source, resolved))
		return yield* Effect.fail(
			new Error(
				"The export folder cannot contain or be contained by the open Editor project.",
			),
		);

	const home = yield* fileSystem.realPath(app.getPath("home"));
	const protectedTrees = yield* Effect.forEach(
		[
			app.getPath("userData"),
			...(app.isPackaged
				? [
						app.getAppPath(),
						...(typeof process.resourcesPath === "string"
							? [
									process.resourcesPath,
								]
							: []),
					]
				: []),
		],
		fileSystem.realPath,
	);
	if (
		containsPath(path, resolved, home) ||
		protectedTrees.some((protectedPath) => overlapsPath(path, resolved, protectedPath))
	) {
		return yield* Effect.fail(
			new Error(
				"Choose a dedicated export folder outside the home root, application bundle, and Arkini data directory.",
			),
		);
	}
	return resolved;
});

const copyEditorProjectFx = Effect.fn("copyEditorProjectFx")(function* ({
	revision,
	source,
	target,
}: {
	readonly revision: number;
	readonly source: string;
	readonly target: string;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	yield* fileSystem.remove(target, {
		force: true,
		recursive: true,
	});
	yield* fileSystem.copy(source, target, {
		overwrite: true,
		preserveTimestamps: true,
	});
	const files = yield* fileSystem.readDirectory(target, {
		recursive: true,
	});
	for (const file of files) {
		if (file === "editor.lock" || file.endsWith(".tmp"))
			yield* fileSystem.remove(path.join(target, file), {
				force: true,
				recursive: true,
			});
	}
	return {
		json: files.filter((file) => file.endsWith(".json")).length,
		projectDirectory: target,
		resources: files.filter((file) => file.endsWith(".png")).length,
		revision,
		root: target,
	} satisfies exportEditorJsonDirectoryFx.Success;
});

/** Replaces one explicitly selected folder with a direct copy of the open Editor project. */
export const exportEditorJsonDirectoryFx = Effect.fn("exportEditorJsonDirectoryFx")(
	({ projectId, repository, window }: exportEditorJsonDirectoryFx.Props) =>
		Effect.gen(function* () {
			const selection = yield* Effect.tryPromise({
				try: () =>
					dialog.showOpenDialog(window, {
						title: "Choose Editor project export folder",
						buttonLabel: "Choose folder",
						properties: [
							"openDirectory",
							"createDirectory",
						],
					}),
				catch: (cause) => cause,
			});
			const selected = selection.filePaths[0];
			if (selection.canceled || selected === undefined) return null;

			yield* repository.awaitIdleFx;
			const [project, source] = yield* Effect.all([
				repository.readProjectFx(projectId),
				repository.readProjectRootFx(projectId),
			]);
			if (project === null || source === null)
				return yield* Effect.fail(
					new EditorProjectRepositoryError({
						operation: "export-json-directory",
						message: `Editor project ${projectId} does not exist.`,
					}),
				);
			const target = yield* assertSafeExportRootFx({
				source,
				target: selected,
			});
			const confirmation = yield* Effect.tryPromise({
				try: () =>
					dialog.showMessageBox(window, {
						type: "warning",
						title: "Replace Editor project export folder?",
						message: "Replace the entire selected folder?",
						detail: `${target}\n\nEvery existing file and subfolder will be permanently deleted and replaced by the open Editor project folder.`,
						buttons: [
							"Cancel",
							"Replace and export",
						],
						cancelId: 0,
						defaultId: 0,
						noLink: true,
					}),
				catch: (cause) => cause,
			});
			if (confirmation.response !== 1) return null;

			return yield* withFilesystemEditorProjectLockFx(
				source,
				copyEditorProjectFx({
					revision: project.revision,
					source,
					target,
				}),
			);
		}).pipe(
			Effect.provide(NodeServices.layer),
			Effect.mapError((cause) =>
				cause instanceof EditorProjectRepositoryError
					? cause
					: new EditorProjectRepositoryError({
							operation: "export-json-directory",
							message:
								cause instanceof Error
									? cause.message
									: "The Editor project folder could not be exported.",
							cause,
						}),
			),
		),
);
