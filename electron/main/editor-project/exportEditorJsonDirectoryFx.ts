import * as NodeServices from "@effect/platform-node/NodeServices";
import { dialog, type BrowserWindow } from "electron";
import { Effect } from "effect";

import { EditorProjectRepositoryError } from "~/project-authoring/repository/EditorProjectRepositoryError";
import { encodeGameProjectFileStemFn } from "~/game-config/source/encodeGameProjectFileStemFn";
import { createEditorJsonExportDirectoryFx } from "./createEditorJsonExportDirectoryFx";
import type { OwnedEditorProjectRepository } from "./EditorProjectServiceOwnership";
import { withProjectLockFx } from "./filesystem/fx/withProjectLockFx";
import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";

export namespace exportEditorJsonDirectoryFx {
	export interface Props {
		readonly projectId: string;
		readonly repository: OwnedEditorProjectRepository;
		readonly window: BrowserWindow;
	}

	export interface Success {
		readonly json: number;
		readonly resources: number;
		readonly revision: number;
		readonly root: string;
	}
}

/** Creates one directly re-openable JSON export without replacing an existing path. */
export const exportEditorJsonDirectoryFx = Effect.fn("exportEditorJsonDirectoryFx")(
	({ projectId, repository, window }: exportEditorJsonDirectoryFx.Props) =>
		Effect.gen(function* () {
			const filesystemWrite = yield* createFilesystemWriteFx();
			const selection = yield* Effect.tryPromise({
				try: () =>
					dialog.showOpenDialog(window, {
						title: "Choose where to create the Editor project export",
						buttonLabel: "Choose destination",
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
			const exported = yield* withProjectLockFx(
				filesystemWrite,
				source,
				createEditorJsonExportDirectoryFx({
					directoryName: encodeGameProjectFileStemFn(projectId),
					parent: selected,
					source,
				}),
			);
			return exported satisfies exportEditorJsonDirectoryFx.Success;
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
