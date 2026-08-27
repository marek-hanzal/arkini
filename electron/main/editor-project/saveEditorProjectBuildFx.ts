import * as NodeServices from "@effect/platform-node/NodeServices";
import { dialog, type BrowserWindow } from "electron";
import { FileSystem } from "effect";
import { Effect } from "effect";

import type { EditorProjectTransport } from "../../contract/editor/EditorProjectTransport";
import { writeArkpackArtifactPairFx } from "../arkpack/writeArkpackArtifactPairFx";
import type { OwnedEditorProjectRepository } from "./EditorProjectServiceOwnership";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";

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
						defaultPath: `${encodeGameProjectFileStem(request.projectId)}.arkpack`,
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

			const content = yield* repository.readProjectBuildFx(request);
			const arkpackPath = selection.filePath.endsWith(".arkpack")
				? selection.filePath
				: `${selection.filePath}.arkpack`;
			const fileSystem = yield* FileSystem.FileSystem;
			yield* writeArkpackArtifactPairFx({
				arkpackPath,
				bytes: content.bytes,
				fileSystem,
			});
			return true;
		}).pipe(
			Effect.provide(NodeServices.layer),
			Effect.mapError((cause) =>
				cause instanceof EditorProjectRepositoryError
					? cause
					: new EditorProjectRepositoryError({
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
