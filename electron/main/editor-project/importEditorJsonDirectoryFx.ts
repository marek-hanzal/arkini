import { dialog, type BrowserWindow } from "electron";
import { Effect } from "effect";

import type { EditorProjectDescriptor } from "~/project-authoring/EditorProjectDescriptor";
import { EditorProjectRepositoryError } from "~/project-authoring/repository/EditorProjectRepositoryError";
import type { OwnedEditorProjectRepository } from "./EditorProjectServiceOwnership";

export namespace importEditorJsonDirectoryFx {
	export interface Props {
		readonly repository: OwnedEditorProjectRepository;
		readonly window: BrowserWindow;
	}
}

/** Opens one valid Editor project folder directly in its selected filesystem location. */
export const importEditorJsonDirectoryFx = Effect.fn("importEditorJsonDirectoryFx")(
	({ repository, window }: importEditorJsonDirectoryFx.Props) =>
		Effect.gen(function* () {
			const selection = yield* Effect.tryPromise({
				try: () =>
					dialog.showOpenDialog(window, {
						title: "Open Editor project folder",
						buttonLabel: "Open",
						properties: [
							"openDirectory",
						],
					}),
				catch: (cause) => cause,
			});
			const root = selection.filePaths[0];
			if (selection.canceled || root === undefined) return null;

			const project = yield* repository.openProjectFx({
				root,
			});
			return {
				projectId: project.projectId,
				title: project.title,
				version: project.version,
				createdAtMs: project.createdAtMs,
				updatedAtMs: project.updatedAtMs,
			} satisfies EditorProjectDescriptor;
		}).pipe(
			Effect.mapError((cause) =>
				cause instanceof EditorProjectRepositoryError
					? cause
					: new EditorProjectRepositoryError({
							operation: "import-json-directory",
							message:
								cause instanceof Error
									? cause.message
									: "The Editor project folder could not be opened.",
							cause,
						}),
			),
		),
);
