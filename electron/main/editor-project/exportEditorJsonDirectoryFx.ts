import * as NodeServices from "@effect/platform-node/NodeServices";
import { randomUUID } from "node:crypto";
import { app, dialog, type BrowserWindow } from "electron";
import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { writeGameSourceDirectoryFx } from "~/engine/source/fx/writeGameSourceDirectoryFx";

export namespace exportEditorJsonDirectoryFx {
	export interface Props {
		readonly projectId: string;
		readonly repository: EditorProjectRepositoryService;
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

const assertSafeExportRootFx = Effect.fn("assertSafeExportRootFx")(function* (root: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const resolved = yield* fileSystem.realPath(path.resolve(root));
	if (path.parse(resolved).root === resolved) {
		return yield* Effect.fail(new Error("A filesystem root cannot be managed by the Editor."));
	}
	const home = yield* fileSystem.realPath(app.getPath("home"));
	const protectedTrees = yield* Effect.forEach(
		[
			app.getPath("userData"),
			app.getAppPath(),
			...(typeof process.resourcesPath === "string"
				? [
						process.resourcesPath,
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
				"Choose a dedicated export folder outside the home root, application bundle, source checkout, and Arkini data directory.",
			),
		);
	}
	return resolved;
});

const replaceExportRootFx = Effect.fn("replaceExportRootFx")(function* ({
	project,
	target,
}: {
	readonly project: EditorProject;
	readonly target: string;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const parent = path.dirname(target);
	const basename = path.basename(target);
	const suffix = randomUUID();
	const staging = path.join(parent, `.${basename}.${suffix}.pending`);
	const previous = path.join(parent, `.${basename}.${suffix}.previous`);

	const writeAndSwap = Effect.gen(function* () {
		yield* fileSystem.makeDirectory(staging, {
			recursive: true,
		});
		const written = yield* writeGameSourceDirectoryFx({
			config: project.config,
			output: staging,
			resources: project.resources,
		});
		const swap = fileSystem.rename(target, previous).pipe(
			Effect.andThen(
				fileSystem
					.rename(staging, target)
					.pipe(
						Effect.catch((cause) =>
							fileSystem
								.rename(previous, target)
								.pipe(Effect.andThen(Effect.fail(cause))),
						),
					),
			),
			Effect.andThen(
				fileSystem
					.remove(previous, {
						force: true,
						recursive: true,
					})
					.pipe(Effect.ignore),
			),
		);
		yield* Effect.uninterruptible(swap);
		return {
			json: written.json,
			projectDirectory: target,
			resources: written.resources,
			revision: project.revision,
			root: target,
		} satisfies exportEditorJsonDirectoryFx.Success;
	});

	return yield* writeAndSwap.pipe(
		Effect.ensuring(
			fileSystem
				.remove(staging, {
					force: true,
					recursive: true,
				})
				.pipe(Effect.ignore),
		),
	);
});

/** Replaces one explicitly selected Editor-managed folder with a fresh JSON source tree. */
export const exportEditorJsonDirectoryFx = Effect.fn("exportEditorJsonDirectoryFx")(
	({ projectId, repository, window }: exportEditorJsonDirectoryFx.Props) =>
		Effect.gen(function* () {
			const selection = yield* Effect.tryPromise({
				try: () =>
					dialog.showOpenDialog(window, {
						title: "Choose Editor-managed JSON export folder",
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
			const target = yield* assertSafeExportRootFx(selected);
			const confirmation = yield* Effect.tryPromise({
				try: () =>
					dialog.showMessageBox(window, {
						type: "warning",
						title: "Replace Editor-managed export folder?",
						message: "Replace the entire selected folder?",
						detail: `${target}\n\nEvery existing file and subfolder will be permanently deleted and replaced by the current Editor source export.`,
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

			yield* repository.awaitIdleFx;
			const project = yield* repository.readProjectFx(projectId);
			if (project === null) {
				return yield* Effect.fail(
					new EditorProjectRepositoryError({
						operation: "export-json-directory",
						message: `Editor project ${projectId} does not exist.`,
					}),
				);
			}
			return yield* replaceExportRootFx({
				project,
				target,
			});
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
									: "The JSON source directory could not be exported.",
							cause,
						}),
			),
		),
);
