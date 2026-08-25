import * as NodeServices from "@effect/platform-node/NodeServices";
import { dialog, type BrowserWindow } from "electron";
import { Effect } from "effect";

import type { EditorProjectDescriptor } from "~/editor/EditorProjectDescriptor";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { compileGameDirectoryFx } from "~/engine/compiler/fx/compileGameDirectoryFx";
import { readPngAssetFx } from "~/engine/pack/fx/readPngAssetFx";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";
import { assertGameConfigValidFx } from "~/engine/validation/fx/assertGameConfigValidFx";

export namespace importEditorJsonDirectoryFx {
	export interface Props {
		readonly repository: EditorProjectRepositoryService;
		readonly window: BrowserWindow;
	}
}

const readFailureMessage = (cause: unknown) => {
	if (cause instanceof EditorProjectRepositoryError) return cause.message;
	if (cause instanceof GameValidationError) {
		const diagnostic = cause.diagnostics[0];
		if (diagnostic === undefined) return "The JSON game config is invalid.";
		const location = diagnostic.source === undefined ? "" : ` in ${diagnostic.source}`;
		return `The JSON game config is invalid${location}: ${diagnostic.message}`;
	}
	return cause instanceof Error ? cause.message : "The JSON game config could not be imported.";
};

/** Selects, compiles, and atomically imports one fragmented JSON game directory. */
export const importEditorJsonDirectoryFx = Effect.fn("importEditorJsonDirectoryFx")(
	({ repository, window }: importEditorJsonDirectoryFx.Props) =>
		Effect.gen(function* () {
			const selection = yield* Effect.tryPromise({
				try: () =>
					dialog.showOpenDialog(window, {
						title: "Import JSON game config",
						buttonLabel: "Import",
						properties: [
							"openDirectory",
						],
					}),
				catch: (cause) => cause,
			});
			if (selection.canceled || selection.filePaths[0] === undefined) return null;

			const compilation = yield* compileGameDirectoryFx({
				input: selection.filePaths[0],
			});
			const config = yield* assertGameConfigValidFx(compilation);
			const resources = yield* Effect.forEach(compilation.resources, ({ path }) =>
				readPngAssetFx({
					path,
				}),
			);
			const project = yield* repository.createProjectFx({
				projectId: config.meta.id,
				version: "1.0",
				config,
				resources,
			});

			return {
				projectId: project.projectId,
				title: project.title,
				version: project.version,
				createdAtMs: project.createdAtMs,
				updatedAtMs: project.updatedAtMs,
			} satisfies EditorProjectDescriptor;
		}).pipe(
			Effect.provide(NodeServices.layer),
			Effect.mapError((cause) =>
				cause instanceof EditorProjectRepositoryError
					? cause
					: new EditorProjectRepositoryError({
							operation: "import-json-directory",
							message: readFailureMessage(cause),
							cause,
						}),
			),
		),
);
