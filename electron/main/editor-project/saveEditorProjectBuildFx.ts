import * as NodeServices from "@effect/platform-node/NodeServices";
import { copyFile } from "node:fs/promises";
import { dialog, type BrowserWindow } from "electron";
import { Effect } from "effect";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";

const copyFileFx = Effect.fn("saveEditorProjectBuildFx.copyFileFx")(
	(source: string, target: string) =>
		Effect.tryPromise({
			try: () => copyFile(source, target),
			catch: (cause) => cause,
		}),
);

/** Saves the exact current local Editor build through one native file choice. */
export const saveEditorProjectBuildFx = Effect.fn("saveEditorProjectBuildFx")(
	({
		repository,
		request,
		window,
	}: {
		readonly repository: OwnedEditorProjectRepository;
		readonly request: EditorProjectTransport.ReadBuildRequest;
		readonly window: BrowserWindow;
	}) =>
		Effect.gen(function* () {
			const selection = yield* Effect.tryPromise({
				try: () =>
					dialog.showSaveDialog(window, {
						title: "Save Arkpack",
						buttonLabel: "Save Arkpack",
						defaultPath: readArkpackArtifactNameFn(request.projectId),
						filters: [
							{
								name: "Arkini package",
								extensions: [
									"arkpack",
								],
							},
						],
					}),
				catch: (cause) => cause,
			});
			if (selection.canceled || selection.filePath === undefined) return false;

			const arkpackPath = selection.filePath.endsWith(".arkpack")
				? selection.filePath
				: `${selection.filePath}.arkpack`;
			yield* repository.withProjectBuildPathFx(request, (sourcePath) =>
				sourcePath === arkpackPath ? Effect.void : copyFileFx(sourcePath, arkpackPath),
			);
			return true;
		}).pipe(
			Effect.provide(NodeServices.layer),
			Effect.mapError((cause) =>
				cause instanceof ProjectRepositoryError
					? cause
					: new ProjectRepositoryError({
							operation: "save-project-build",
							message:
								cause instanceof Error
									? cause.message
									: "The Editor build could not be saved.",
							cause,
						}),
			),
		),
);
