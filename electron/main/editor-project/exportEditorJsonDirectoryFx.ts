import * as NodeServices from "@effect/platform-node/NodeServices";
import { app, dialog, type BrowserWindow } from "electron";
import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { withFilesystemLockFx } from "../filesystem/withFilesystemLockFx";
import { assertSafeEditorJsonExportRootFx } from "./assertSafeEditorJsonExportRootFx";
import type { OwnedEditorProjectRepository } from "./EditorProjectServiceOwnership";
import { withFilesystemEditorProjectLockFx } from "./filesystem/fx/withFilesystemEditorProjectLockFx";
import { recoverEditorJsonExportsFx } from "./recoverEditorJsonExportsFx";
import { replaceEditorJsonExportDirectoryFx } from "./replaceEditorJsonExportDirectoryFx";

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

/** Replaces one explicitly selected folder with a direct copy of the open Editor project. */
export const exportEditorJsonDirectoryFx = Effect.fn("exportEditorJsonDirectoryFx")(
	({ projectId, repository, window }: exportEditorJsonDirectoryFx.Props) =>
		Effect.gen(function* () {
			const fileSystem = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const recoveryRoot = path.join(app.getPath("userData"), "editor-export-transactions");
			yield* fileSystem.makeDirectory(recoveryRoot, {
				recursive: true,
			});
			yield* withFilesystemLockFx(
				path.join(recoveryRoot, "recovery.lock"),
				recoverEditorJsonExportsFx(recoveryRoot),
			);
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
			const target = yield* assertSafeEditorJsonExportRootFx({
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

			const exported = yield* withFilesystemEditorProjectLockFx(
				source,
				withFilesystemLockFx(
					path.join(recoveryRoot, "recovery.lock"),
					replaceEditorJsonExportDirectoryFx({
						recoveryRoot,
						source,
						target,
					}),
				),
			);
			return {
				...exported,
				projectDirectory: target,
				root: target,
			} satisfies exportEditorJsonDirectoryFx.Success;
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
